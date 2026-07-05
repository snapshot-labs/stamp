import { getAddress } from '@ethersproject/address';
import { namehash } from '@ethersproject/hash';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { Address, batchContractCalls, EMPTY_ADDRESS, Handle } from '../utils';
import { FetchError, provider as getProvider, isEvmAddress, isSilencedError } from './utils';

// Gwei Name Service: an ENS-compatible .gwei namespace on Ethereum. https://gwei.domains
export const NAME = 'Gwei Name Service';

const NETWORK = '1';
const TLD = '.gwei';
const CONTRACT = '0x9D51D507BC7264d4fE8Ad1cf7Fe191933A0a81d6';
const ABI = [
  'function resolve(uint256 tokenId) view returns (address)',
  'function reverseResolve(address addr) view returns (string)'
];

const provider = getProvider(NETWORK);

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => h.endsWith(TLD));
}

// Token id is the ENS namehash of the name; '' when it can't be normalized.
function tokenId(handle: Handle): string {
  try {
    return namehash(handle);
  } catch {
    return '';
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const pairs = normalizeHandles(handles)
    .map(handle => [handle, tokenId(handle)] as const)
    .filter(([, id]) => id);

  if (pairs.length === 0) return {};

  try {
    const addresses: Record<string, Address> = await batchContractCalls(
      NETWORK,
      provider,
      ABI,
      pairs.map(([, id]) => id),
      new Array(pairs.length).fill(CONTRACT),
      'resolve'
    );

    const results: Record<Handle, Address> = {};
    pairs.forEach(([handle, id]) => {
      const address = addresses[id];
      if (address && address !== EMPTY_ADDRESS) results[handle] = getAddress(address);
    });

    return results;
  } catch (err) {
    if (!isSilencedError(err)) capture(err, { input: { handles } });
    throw new FetchError();
  }
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  try {
    // reverseResolve() is forward-confirmed on-chain, so it's spoofing-safe.
    const names: Record<string, Handle> = await batchContractCalls(
      NETWORK,
      provider,
      ABI,
      normalizedAddresses,
      new Array(normalizedAddresses.length).fill(CONTRACT),
      'reverseResolve'
    );

    const results: Record<Address, Handle> = {};
    normalizedAddresses.forEach(address => {
      const name = names[address];
      if (name && name.endsWith(TLD)) results[address] = name;
    });

    return results;
  } catch (err) {
    if (!isSilencedError(err)) capture(err, { input: { addresses: normalizedAddresses } });
    throw new FetchError();
  }
}
