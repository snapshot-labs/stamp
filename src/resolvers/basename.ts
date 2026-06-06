import { isAddress } from '@ethersproject/address';
import { namehash } from '@ethersproject/hash';
import snapshot from '@snapshot-labs/snapshot.js';
import { lookupAddresses } from '../addressResolvers/basename';
import { max } from '../constants.json';
import { getProvider, resize } from '../utils';
import { fetchHttpImage } from './utils';

const NETWORK = 8453;
const TLD = '.base.eth';
// Basenames L2 Resolver on Base. Source: Coinbase OnchainKit.
const L2_RESOLVER_ADDRESS = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';
const IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs/';

async function castToBasename(nameOrAddress: string): Promise<string | undefined> {
  if (isAddress(nameOrAddress)) {
    // Resolve specifically against Base, since the address may also have an ENS
    // primary name which would not carry the Basename avatar text record.
    return (await lookupAddresses([nameOrAddress]))[nameOrAddress];
  }

  return nameOrAddress;
}

function toHttpUrl(url: string): string | undefined {
  if (url.startsWith('http')) return url;
  if (url.startsWith('ipfs://')) return `${IPFS_GATEWAY}${url.slice('ipfs://'.length)}`;
  return undefined;
}

export default async function resolve(nameOrAddress: string) {
  try {
    const basename = await castToBasename(nameOrAddress);

    if (!basename?.endsWith(TLD)) return false;

    const abi = ['function text(bytes32 node, string key) view returns (string)'];
    const record = await snapshot.utils.call(getProvider(NETWORK), abi, [
      L2_RESOLVER_ADDRESS,
      'text',
      [namehash(basename), 'avatar']
    ]);

    const url = record && toHttpUrl(record);
    if (!url) return false;

    const input = await fetchHttpImage(url);

    return await resize(input, max, max);
  } catch {
    return false;
  }
}
