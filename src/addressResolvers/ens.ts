import { ens_normalize } from '@adraffy/ens-normalize';
import { getAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { forwardLookup, reverseLookup } from './universalResolver';
import { isEvmAddress, isSilencedError } from './utils';
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

function firstReportableError(errors: unknown[]): unknown {
  return errors.find(err => !isSilencedError(err)) ?? errors[0];
}

// Every entry is settled on its own, so a batch can come back with results and
// errors at the same time. index.ts only reports what a resolver throws, so
// errors that arrive alongside results are reported here or not at all.
function reportErrors(errors: unknown[], input: Record<string, unknown>) {
  if (errors.length === 0) return;

  const error = firstReportableError(errors);
  if (!isSilencedError(error)) capture(error, { input });
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const { values, errors } = await reverseLookup(normalizedAddresses);

  // Nothing resolved at all: reject with the original error and let index.ts
  // report or silence it, like any other resolver failure.
  if (errors.length > 0 && Object.keys(values).length === 0) {
    throw firstReportableError(errors);
  }

  reportErrors(errors, { addresses: normalizedAddresses });

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
