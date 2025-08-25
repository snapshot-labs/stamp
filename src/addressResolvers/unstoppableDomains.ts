import snapshot from '@snapshot-labs/snapshot.js';
import Resolution, { NamingServiceName } from '@unstoppabledomains/resolution';
import { capture } from '@snapshot-labs/snapshot-sentry';
import {
  provider as getProvider,
  withoutEmptyValues,
  isSilencedError,
  FetchError,
  isEvmAddress
} from './utils';
import { Address, batchContractCalls, Handle } from '../utils';

export const NAME = 'Unstoppable Domains';
const NETWORK = '137';
const provider = getProvider(NETWORK, { timeout: 5e3 });
const ABI = [
  'function reverseNameOf(address addr) view returns (string reverseUri)',
  'function ownerOf(uint256 tokenId) external view returns (address address)'
];
const CONTRACT_ADDRESS = '0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f';

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.map(h => (/^[.a-z0-9-]+$/.test(h) ? h : '')).filter(h => h);
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  try {
    const names: Record<Address, Handle> = await batchContractCalls(
      NETWORK,
      provider,
      ABI,
      normalizedAddresses,
      new Array(normalizedAddresses.length).fill(CONTRACT_ADDRESS),
      'reverseNameOf'
    );

    return withoutEmptyValues(names);
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { addresses, normalizedAddresses } });
    }
    throw new FetchError();
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  try {
    const results = await Promise.all(
      normalizedHandles.map(async handle => {
        try {
          const tokenId = new Resolution().namehash(handle, NamingServiceName.UNS);
          return await snapshot.utils.call(
            provider,
            ABI,
            [CONTRACT_ADDRESS, 'ownerOf', [tokenId]],
            { blockTag: 'latest' }
          );
        } catch (e) {
          if (!isSilencedError(e)) {
            capture(e, { input: { handles: normalizedHandles } });
          }
          return;
        }
      })
    );

    return withoutEmptyValues(
      Object.fromEntries(normalizedHandles.map((handle, index) => [handle, results[index]]))
    );
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { handles: normalizedHandles } });
    }
    throw new FetchError();
  }
}
