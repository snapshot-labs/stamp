import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import Resolution, { NamingServiceName } from '@unstoppabledomains/resolution';
import { isEvmAddress } from '../../helpers/address';
import { isSilencedError, isTransportFailure } from '../../helpers/errors';
import { withoutEmptyValues } from '../../helpers/object';
import { batchContractCalls, getProvider } from '../../helpers/provider';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Unstoppable Domains';
const NETWORK = '137';
const provider = getProvider(NETWORK);
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

  const names: Record<Address, Handle> = await batchContractCalls(
    NETWORK,
    provider,
    ABI,
    normalizedAddresses,
    new Array(normalizedAddresses.length).fill(CONTRACT_ADDRESS),
    'reverseNameOf'
  );

  return withoutEmptyValues(names);
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  // Kept: this is per-handle partial-failure handling, not the resolver-level
  // "give up" catch. One unresolvable handle must not drop the whole batch, and
  // index.ts never sees the error, so it has to be reported from here.
  const results = await Promise.all(
    normalizedHandles.map(async handle => {
      try {
        const tokenId = new Resolution().namehash(handle, NamingServiceName.UNS);
        return await snapshot.utils.call(provider, ABI, [CONTRACT_ADDRESS, 'ownerOf', [tokenId]], {
          blockTag: 'latest'
        });
      } catch (err) {
        if (!isSilencedError(err) && !isTransportFailure(err)) {
          capture(err, { input: { handles: normalizedHandles } });
        }
        return;
      }
    })
  );

  return withoutEmptyValues(
    Object.fromEntries(normalizedHandles.map((handle, index) => [handle, results[index]]))
  );
}
