import { ens_normalize } from '@adraffy/ens-normalize';
import { getAddress } from '@ethersproject/address';
import { namehash } from '@ethersproject/hash';
import snapshot from '@snapshot-labs/snapshot.js';
import { EMPTY_ADDRESS, isEvmAddress } from '../../helpers/address';
import { getUrl } from '../../helpers/http';
import { provider as getProvider } from '../../helpers/provider';
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

async function collect(
  items: string[],
  query: (item: string) => Promise<[string, string]>
): Promise<Record<string, string>> {
  const entries = await Promise.all(items.map(query));
  return Object.fromEntries(entries.filter(([, value]) => value));
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  return collect(addresses.filter(isEvmAddress), async address => [
    address,
    normalizeBasename(await call('name', [reverseNode(address)]))
  ]);
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  return collect(handles.map(normalizeBasename).filter(Boolean), async handle => {
    const address = await call('addr', [namehash(handle)]);
    return [handle, address && address !== EMPTY_ADDRESS ? getAddress(address) : ''];
  });
}

// Avatar text record, used by the avatar resolver. Resolves the name against
// Base specifically, so an address' ENS primary name can't shadow its Basename.
export async function getAvatar(nameOrAddress: string): Promise<string | null> {
  const name = isEvmAddress(nameOrAddress)
    ? (await lookupAddresses([nameOrAddress]))[nameOrAddress]
    : normalizeBasename(nameOrAddress);

  return name ? getUrl(await call('text', [namehash(name), 'avatar'])) : null;
}
