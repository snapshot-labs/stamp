import { ens_normalize } from '@adraffy/ens-normalize';
import { getAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { markNonCacheable } from './cache';
import { reverseLookup } from './universalResolver';
import constants from '../../constants.json';
import { isEvmAddress } from '../../helpers/address';
import { isSilencedError, isTransportFailure } from '../../helpers/errors';
import { graphQlCall } from '../../helpers/graphql';
import { getProvider } from '../../helpers/provider';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Ens';
const NETWORK = '1';
const provider = getProvider(NETWORK);

function normalizeEns(names: Handle[]): Handle[] {
  return names.map(name => {
    try {
      return ens_normalize(name) === name ? name : '';
    } catch {
      return '';
    }
  });
}

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

function normalizeHandles(names: Handle[]): Handle[] {
  return normalizeEns(names).filter(h => h);
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const { values, errors } = await reverseLookup(normalizedAddresses);

  if (errors.length === normalizedAddresses.length) {
    throw (errors.find(({ error }) => !isSilencedError(error)) || errors[0]).error;
  }

  errors.forEach(({ address, error }) => {
    if (!isSilencedError(error)) {
      capture(error, {
        tags: { provider: NAME },
        contexts: { input: { lookupAddresses: [address] } }
      });
    }
  });

  const validNames = normalizeEns(normalizedAddresses.map(address => values[address] || ''));
  const result = Object.fromEntries(
    normalizedAddresses
      .map((address, index) => [address, validNames[index]])
      .filter((_, index) => !!validNames[index])
  );

  return markNonCacheable(
    result,
    errors.map(({ address }) => address)
  );
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const results = {};

  try {
    const {
      data: { domains: items }
    } = await graphQlCall(
      constants.ensSubgraph[NETWORK],
      `query Domains($handles: [String!]!) {
        domains(where: {name_in: $handles}) {
          name
          resolvedAddress {
            id
          }
        }
      }`,
      { handles: normalizedHandles }
    );

    for (const item of items) {
      try {
        results[item.name] = item.resolvedAddress ? getAddress(item.resolvedAddress.id) : '';
      } catch (err) {
        if (!isSilencedError(err)) {
          capture(err, { input: { handles: normalizedHandles } });
        }
      }
    }
  } catch (err) {
    if (!isSilencedError(err) && !isTransportFailure(err)) {
      capture(err, { input: { handles: normalizedHandles } });
    }
  }

  const unresolvedHandles = normalizedHandles.filter(handle => !results[handle]);

  if (unresolvedHandles.length === 0) return results;

  try {
    const providerResults = await Promise.allSettled(
      unresolvedHandles.map(handle => provider.resolveName(handle))
    );

    unresolvedHandles.forEach((handle, index) => {
      const result = providerResults[index];
      if (result.status === 'fulfilled' && result.value) {
        results[handle] = getAddress(result.value);
      }
    });
  } catch (err) {
    if (!isSilencedError(err) && !isTransportFailure(err)) {
      capture(err, { input: { handles: normalizedHandles } });
    }
  }

  return results;
}
