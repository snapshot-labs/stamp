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
// Basenames L2 Resolver on Base. Source: Coinbase OnchainKit.
const RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';
const ABI = [
  'function name(bytes32 node) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)'
];

const provider = getProvider(NETWORK);

function call(method: string, params: any[]): Promise<string> {
  return snapshot.utils.call(provider, ABI, [RESOLVER, method, params], { blockTag: 'latest' });
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

  const names: Record<string, Handle> = await batchContractCalls(
    NETWORK,
    provider,
    ABI,
    pairs.map(([, node]) => node),
    new Array(pairs.length).fill(RESOLVER),
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

  const addresses: Record<string, Address> = await batchContractCalls(
    NETWORK,
    provider,
    ABI,
    pairs.map(([, node]) => node),
    new Array(pairs.length).fill(RESOLVER),
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

  return name ? getUrl(await call('text', [namehash(name), 'avatar'])) : null;
}
