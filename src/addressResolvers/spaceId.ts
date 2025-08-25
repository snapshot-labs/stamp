import { namehash } from '@ethersproject/hash';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { Address, batchContractCalls, EMPTY_ADDRESS, Handle } from '../utils';
import { provider as getProvider, isEvmAddress, isSilencedError, FetchError } from './utils';

// NOTE: Space ID supports multiple networks and TLDs, this file only implements BNB with .bnb TLD
// https://www.space.id/
export const NAME = 'Space ID';

const NETWORK = '56'; // BNB
const TLD = '.bnb';
const BNB_REGISTRY_CONTRACT = '0x08CEd32a7f3eeC915Ba84415e9C07a7286977956';
const REGISTRY_ABI = ['function resolver(bytes32 node) external view returns (address address)'];
const RESOLVER_ABI = [
  'function addr(bytes32 node) external view returns (address address)',
  'function name(bytes32 node) view returns (string name)'
];

const provider = getProvider(NETWORK, { timeout: 5e3 });

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => h.endsWith(TLD));
}

// Call the relevant contracts to get the mapping of namehash -> address/handle
// 1. Get the resolver address for each namehash from the registry contract
// 2. Get the address/handle for each namehash from the relevant resolver contract
//
// Flow from https://github.com/Space-ID/web3-name-sdk/blob/main/packages/core/src/tlds/web3name/index.ts
async function resolveNameHashes(
  hashes: string[],
  fnName: string
): Promise<Record<string, Address | Handle>> {
  try {
    // Fetch the mapping of namehash -> resolver address
    const resolvers: Record<string, Address> = await batchContractCalls(
      NETWORK,
      provider,
      REGISTRY_ABI,
      hashes,
      new Array(hashes.length).fill(BNB_REGISTRY_CONTRACT),
      'resolver'
    );

    Object.keys(resolvers).forEach(hash => {
      if (resolvers[hash] === EMPTY_ADDRESS) delete resolvers[hash];
    });

    if (Object.keys(resolvers).length === 0) return {};

    // Fetch the mapping of namehash -> address/handle
    return await batchContractCalls(
      NETWORK,
      provider,
      RESOLVER_ABI,
      Object.keys(resolvers),
      Object.values(resolvers),
      fnName
    );
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { hashes, fnName } });
    }
    throw new FetchError();
  }
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const reverseNamehashes = normalizedAddresses.map(addr => {
    return namehash(`${addr.slice(2)}.addr.reverse`);
  });
  const names: Record<string, Handle> = await resolveNameHashes(reverseNamehashes, 'name');
  const results = {};

  Object.entries(names).forEach(([hash, name]) => {
    const addr = normalizedAddresses[reverseNamehashes.indexOf(hash)];
    if (addr && name.endsWith(TLD)) results[addr] = name;
  });

  return results;
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const namehashes = normalizedHandles.map(namehash);
  const addresses: Record<string, Address> = await resolveNameHashes(namehashes, 'addr');
  const results = {};

  Object.entries(addresses).forEach(([hash, addr]) => {
    const handle = normalizedHandles[namehashes.indexOf(hash)];
    if (handle) results[handle] = addr;
  });

  return results;
}
