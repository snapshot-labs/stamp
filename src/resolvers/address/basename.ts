import { ens_normalize } from '@adraffy/ens-normalize';
import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { namehash } from 'viem/ens';
import { EMPTY_ADDRESS, isEvmAddress } from '../../helpers/address';
import { getUrl } from '../../helpers/http';
import { batchContractCalls, getProvider } from '../../helpers/provider';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Basename';
const NETWORK = '8453';
const TLD = '.base.eth';
// ENSIP-11 coinType for Base: (0x80000000 | 8453) >>> 0, in hex.
const COIN_TYPE = '80002105';
// Basenames Registry on Base. Each node points at the resolver holding its
// records; Base has upgraded the default resolver since launch, so names
// registered at different times live on different resolvers.
const REGISTRY = '0xB94704422c2a1E396835A571837Aa5AE53285a95';
// Original Basenames L2 Resolver, used when the registry has no resolver for a
// node (source: Coinbase OnchainKit).
const LEGACY_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';
const REGISTRY_ABI = ['function resolver(bytes32 node) view returns (address)'];
const ABI = [
  'function name(bytes32 node) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)'
];

const provider = getProvider(NETWORK);

async function resolversFor(nodes: string[]): Promise<Record<string, Address>> {
  const found: Record<string, Address> = await batchContractCalls(
    NETWORK,
    provider,
    REGISTRY_ABI,
    nodes,
    new Array(nodes.length).fill(REGISTRY),
    'resolver'
  );

  const resolvers: Record<string, Address> = {};
  nodes.forEach(node => {
    const resolver = found[node];
    resolvers[node] = resolver && resolver !== EMPTY_ADDRESS ? resolver : LEGACY_RESOLVER;
  });

  return resolvers;
}

async function batchRecords(nodes: string[], fnName: string): Promise<Record<string, string>> {
  const resolvers = await resolversFor(nodes);

  return batchContractCalls(
    NETWORK,
    provider,
    ABI,
    nodes,
    nodes.map(node => resolvers[node]),
    fnName
  );
}

async function call(node: string, method: string, params: any[]): Promise<string> {
  const resolver = (await resolversFor([node]))[node];
  return snapshot.utils.call(provider, ABI, [resolver, method, params], { blockTag: 'latest' });
}

// Basename records live on Base L2, so reverse resolution reads the ENSIP-11
// chain-specific reverse name ([addr].[coinType].reverse) from the L2 resolver,
// not the mainnet reverse registrar that ENS uses.
function reverseNode(address: Address): string {
  return namehash(`${address.toLowerCase().slice(2)}.${COIN_TYPE}.reverse`);
}

function normalizeBasename(name: Handle): Handle {
  try {
    return name?.endsWith(TLD) && ens_normalize(name) === name ? name : '';
  } catch {
    return '';
  }
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const pairs = addresses
    .filter(isEvmAddress)
    .map(address => [address, reverseNode(address)] as const);

  if (pairs.length === 0) return {};

  const names: Record<string, Handle> = await batchRecords(
    pairs.map(([, node]) => node),
    'name'
  );

  const results: Record<Address, Handle> = {};
  pairs.forEach(([address, node]) => {
    const name = normalizeBasename(names[node]);
    if (name) results[address] = name;
  });

  return results;
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const pairs = handles
    .map(normalizeBasename)
    .filter(Boolean)
    .map(handle => [handle, namehash(handle)] as const);

  if (pairs.length === 0) return {};

  const addresses: Record<string, Address> = await batchRecords(
    pairs.map(([, node]) => node),
    'addr'
  );

  const results: Record<Handle, Address> = {};
  pairs.forEach(([handle, node]) => {
    const address = addresses[node];
    if (address && address !== EMPTY_ADDRESS) results[handle] = getAddress(address);
  });

  return results;
}

// Avatar text record, used by the avatar resolver. Resolves the name against
// Base specifically, so an address' ENS primary name can't shadow its Basename.
export async function getAvatar(nameOrAddress: string): Promise<string | null> {
  const name = isEvmAddress(nameOrAddress)
    ? (await lookupAddresses([nameOrAddress]))[nameOrAddress]
    : normalizeBasename(nameOrAddress);

  if (!name) return null;

  const node = namehash(name);
  return getUrl(await call(node, 'text', [node, 'avatar']));
}
