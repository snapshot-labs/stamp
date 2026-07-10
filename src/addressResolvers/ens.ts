import { ens_normalize } from '@adraffy/ens-normalize';
import { getAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { forwardLookup, reverseLookup } from './universalResolver';
import { FetchError, isEvmAddress, isSilencedError } from './utils';
import { Address, Handle } from '../utils';

export const NAME = 'Ens';

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

function reportErrors(errors: unknown[], input: Record<string, unknown>) {
  const error = errors.find(err => !isSilencedError(err));
  if (error) capture(error, { input });
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const { values, errors } = await reverseLookup(normalizedAddresses);

  reportErrors(errors, { addresses: normalizedAddresses });

  if (errors.length > 0 && Object.keys(values).length === 0) {
    throw new FetchError();
  }

  const validNames = normalizeEns(normalizedAddresses.map(address => values[address] || ''));

  return Object.fromEntries(
    normalizedAddresses
      .map((address, index) => [address, validNames[index]])
      .filter((_, index) => !!validNames[index])
  );
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const { values, errors } = await forwardLookup(normalizedHandles);

  reportErrors(errors, { handles: normalizedHandles });

  const results: Record<Handle, Address> = {};
  for (const [handle, address] of Object.entries(values)) {
    try {
      results[handle] = getAddress(address);
    } catch {}
  }

  return results;
}
