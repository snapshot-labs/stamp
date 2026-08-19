import { namehash } from '@ethersproject/hash';
import { EMPTY_ADDRESS, isEvmAddress } from '../../helpers/address';
import { batchContractCalls, getProvider } from '../../helpers/provider';
import { Address, Handle } from '../../helpers/types';

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

const provider = getProvider(NETWORK);

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
  const pairs = normalizeHandles(handles).flatMap(handle => {
    try {
      return [[handle, namehash(handle)] as const];
    } catch {
      return [];
    }
  });

  if (pairs.length === 0) return {};

  const addresses: Record<string, Address> = await resolveNameHashes(
    pairs.map(([, hash]) => hash),
    'addr'
  );
  const results = {};

  Object.entries(addresses).forEach(([hash, addr]) => {
    const handle = pairs.find(([, pairHash]) => pairHash === hash)?.[0];
    if (handle) results[handle] = addr;
  });

  return results;
}
