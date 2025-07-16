import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { ens_normalize } from '@adraffy/ens-normalize';
import { isEvmAddress } from './utils';
import {
  Address,
  graphQlCall,
  Handle,
  provider as getProvider,
  isSilencedError,
  FetchError
} from '../utils';
import constants from '../constants.json';

export const NAME = 'Ens';
const NETWORK = '1';
const provider = getProvider(NETWORK);

function normalizeEns(names: Handle[]): Handle[] {
  return names.map(name => {
    try {
      return ens_normalize(name) === name ? name : '';
    } catch (e) {
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
  const abi = ['function getNames(address[] addresses) view returns (string[] r)'];
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  try {
    const reverseRecords = await snapshot.utils.call(
      provider,
      abi,
      ['0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C', 'getNames', [normalizedAddresses]],
      { blockTag: 'latest' }
    );
    const validNames = normalizeEns(reverseRecords);

    return Object.fromEntries(
      normalizedAddresses
        .map((address, index) => [address, validNames[index]])
        .filter((_, index) => !!validNames[index])
    );
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { addresses: normalizedAddresses } });
    }
    throw new FetchError();
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const results = {};

  try {
    const {
      data: {
        data: { domains: items }
      }
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
      results[item.name] = item.resolvedAddress ? getAddress(item.resolvedAddress.id) : '';
    }
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { handles: normalizedHandles } });
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
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { handles: normalizedHandles } });
    }
  }

  return results;
}
