import { ens_normalize } from '@adraffy/ens-normalize';
import { getAddress } from '@ethersproject/address';
import { namehash } from '@ethersproject/hash';
import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { FetchError, provider as getProvider, isEvmAddress, isSilencedError } from './utils';
import { Address, EMPTY_ADDRESS, Handle } from '../utils';

export const NAME = 'Basename';
const NETWORK = '8453';
const TLD = 'base.eth';
// ENSIP-11 coinType for Base: (0x80000000 | 8453) >>> 0, lowercased hex.
const COIN_TYPE = '80002105';
// Basenames L2 Resolver on Base. Source: Coinbase OnchainKit.
const L2_RESOLVER_ADDRESS = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';

const provider = getProvider(NETWORK);

// Basename primary names live on Base L2, so reverse resolution uses the
// ENSIP-11 chain-specific reverse namespace ([addr].[coinType].reverse) read
// directly from the L2 resolver, rather than the mainnet reverse registrar.
function reverseNode(address: Address): string {
  return namehash(`${address.toLowerCase().slice(2)}.${COIN_TYPE}.reverse`);
}

function normalizeBasename(name: Handle): Handle {
  if (!name?.endsWith(`.${TLD}`)) return '';

  try {
    return ens_normalize(name) === name ? name : '';
  } catch {
    return '';
  }
}

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

function normalizeHandles(names: Handle[]): Handle[] {
  return names.map(normalizeBasename).filter(h => h);
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const abi = ['function name(bytes32 node) view returns (string)'];

  try {
    const names = await Promise.all(
      normalizedAddresses.map(address =>
        snapshot.utils.call(provider, abi, [L2_RESOLVER_ADDRESS, 'name', [reverseNode(address)]], {
          blockTag: 'latest'
        })
      )
    );

    return Object.fromEntries(
      normalizedAddresses
        .map((address, index) => [address, normalizeBasename(names[index])])
        .filter(([, name]) => !!name)
    );
  } catch (err) {
    if (!isSilencedError(err)) {
      capture(err, { input: { addresses: normalizedAddresses } });
    }
    throw new FetchError();
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const abi = ['function addr(bytes32 node) view returns (address)'];

  try {
    const addresses = await Promise.all(
      normalizedHandles.map(handle =>
        snapshot.utils.call(provider, abi, [L2_RESOLVER_ADDRESS, 'addr', [namehash(handle)]], {
          blockTag: 'latest'
        })
      )
    );

    return Object.fromEntries(
      normalizedHandles
        .map((handle, index) => [
          handle,
          addresses[index] && addresses[index] !== EMPTY_ADDRESS ? getAddress(addresses[index]) : ''
        ])
        .filter(([, address]) => !!address)
    );
  } catch (err) {
    if (!isSilencedError(err)) {
      capture(err, { input: { handles: normalizedHandles } });
    }
    throw new FetchError();
  }
}
