import { createHash } from 'crypto';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import snapshot from '@snapshot-labs/snapshot.js';
import { Response } from 'express';
import sharp from 'sharp';
import chains from './chains.json';
import constants from './constants.json';

export const DEFAULT_TIMEOUT = 5e3;

export type Address = string;
export type Handle = string;
export type ResolverType =
  | 'avatar'
  | 'user-cover'
  | 'token'
  | 'space'
  | 'space-cover'
  | 'space-logo'
  | 'space-sx'
  | 'space-cover-sx'
  | 'address'
  | 'name';

const providers: Record<string, StaticJsonRpcProvider> = {};

const RESIZE_FITS = ['cover', 'contain', 'fill', 'inside', 'outside'];

export const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getProvider(network: number): StaticJsonRpcProvider {
  if (!providers[`_${network}`])
    providers[`_${network}`] = new StaticJsonRpcProvider(
      {
        url: `https://rpc.snapshot.org/${network}`,
        timeout: 20e3,
        allowGzip: true
      },
      network
    );

  return providers[`_${network}`];
}

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

export async function resize(input, w, h, options?): Promise<Buffer> {
  return sharp(input).resize(w, h, options).webp().toBuffer();
}

export function shortNameToChainId(shortName: string): string | null {
  return shortName in chains.SHORTNAME_TO_CHAIN_ID ? chains.SHORTNAME_TO_CHAIN_ID[shortName] : null;
}

export function chainIdToShortName(chainId: string): string | null {
  return chainId in chains.CHAIN_ID_TO_SHORTNAME ? chains.CHAIN_ID_TO_SHORTNAME[chainId] : null;
}

export function chainIdToName(chainId: string): string | null {
  if (chainId === '1') return 'ethereum';
  if (chainId === '56') return 'binance';
  if (chainId === '250') return 'fantom';
  if (chainId === '137') return 'polygon';
  if (chainId === '42161') return 'arbitrum';

  return null;
}

export async function parseQuery(id: string, type: ResolverType, query) {
  let address = id;
  let network = '1';
  let networkId: string | undefined = undefined;

  // Resolve format
  // let format;
  const chunks = id.split(':');
  if (chunks.length === 2) {
    // format = 'eip3770';
    address = chunks[1];
    networkId = chunks[0];
    network = shortNameToChainId(networkId) || '1';
  } else if (chunks.length === 3) {
    // format = 'caip10';
    address = chunks[2];
    network = chunks[1];
    networkId = chainIdToShortName(network) || 'eth';
  } else if (id.startsWith('did:')) {
    // format = 'did';
    address = id.slice(4);
  }
  // console.log('Format', format);

  address = address.toLowerCase();
  const size = 64;
  const maxSize = type.includes('-cover') ? constants.maxCover : constants.max;
  let s = query.s ? parseInt(query.s) : size;
  if (s < 1 || s > maxSize || isNaN(s)) s = size;
  let w = query.w ? parseInt(query.w) : s;
  if (w < 1 || w > maxSize || isNaN(w)) w = size;
  let h = query.h ? parseInt(query.h) : s;
  if (h < 1 || h > maxSize || isNaN(h)) h = size;

  return {
    address,
    network,
    networkId,
    w,
    h,
    fallback: query.fb === 'jazzicon' ? 'jazzicon' : 'blockie',
    cb: query.cb,
    resolver: query.resolver,
    fit: RESIZE_FITS.includes(query.fit) ? query.fit : undefined
  };
}

export function getUrl(url) {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  return snapshot.utils.getUrl(url, gateway);
}

export function getCacheKey({
  type,
  network,
  address,
  w,
  h,
  fallback,
  cb,
  fit
}: {
  type: ResolverType;
  network: string;
  address: string;
  w: number;
  h: number;
  fallback: string;
  cb?: string;
  fit?: string;
}) {
  const data = { type, network, address, w, h };
  if (fallback !== 'blockie') data['fallback'] = fallback;
  if (cb) data['cb'] = cb;
  if (fit) data['fit'] = fit;

  return sha256(JSON.stringify(data));
}

export function setHeader(res: Response, cacheType: 'SHORT_CACHE' | 'LONG_CACHE' = 'LONG_CACHE') {
  const ttl = cacheType === 'SHORT_CACHE' ? constants.shortTtl : constants.ttl;

  res.set({
    'Content-Type': 'image/webp',
    'Cache-Control': `public, max-age=${ttl}`,
    Expires: new Date(Date.now() + ttl * 1e3).toUTCString()
  });
}

export const getBaseAssetIconUrl = (chainId: string) => {
  if (chainId === '100') {
    return 'https://ipfs.snapshot.box/ipfs/bafkreie4u6cq3o6sarxti5r6riekkimr33fjnu4bw6vhnqcsijvzpxjesm';
  }

  // Matic
  if (chainId === '137') {
    return 'https://github-production-user-asset-6210df.s3.amazonaws.com/1968722/269347324-fc34c3a3-01e8-424a-80f6-0910374ea6de.svg';
  }

  if (chainId === '5000') {
    return 'https://ipfs.snapshot.box/ipfs/bafkreidkucwfn4mzo2gtydrt2wogk3je5xpugom67vhi4h4comaxxjzoz4';
  }

  // Apechain & Curtis
  if (chainId === '33139' || chainId === '33111') {
    return 'https://ipfs.snapshot.box/ipfs/bafybeifjxd2q2znrqdsl5y2oplp6yothjfpzaosxs3kcvnxcacox6wfl5u';
  }

  // Celo
  if (chainId === '42220') {
    return 'https://ipfs.snapshot.box/ipfs/bafkreidvcofeczigbjr7ddapgdugwso6v2l4iolfxys7qg6kfvu2uduyva';
  }

  return 'https://static.cdnlogo.com/logos/e/81/ethereum-eth.svg';
};

export async function graphQlCall(
  url: string,
  query: string,
  variables?: Record<string, any>,
  options: any = {
    headers: {}
  }
) {
  const body: { query: string; variables?: Record<string, any> } = { query };
  if (variables) {
    body.variables = variables;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(options.headers).filter(([, value]) => value !== undefined && value !== null)
      )
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    // Preserve the axios error shape relied on downstream: `error.message`
    // carries the status (so `isSilencedError` substring matching keeps
    // working) and `error.response` exposes both `status` and `data` (the
    // response body) so Sentry context capture keeps the upstream payload.
    const data = await response.text().catch(() => undefined);
    throw new GraphqlError(
      `GraphQL request failed with status code ${response.status}`,
      response.status,
      data
    );
  }

  // Preserve the previous axios response shape (`{ data: <body> }`) so callers
  // that destructure `{ data: { data } }` keep working.
  return { data: await response.json() };
}

export class GraphqlError extends Error {
  response: { status: number; data?: string };

  constructor(message: string, status: number, data?: string) {
    super(message);
    this.name = 'GraphqlError';
    this.response = { status, data };
  }
}

/**
 * Executes batch contract calls using multicall pattern
 * @param network - The network identifier
 * @param provider - The blockchain provider instance
 * @param abi - The contract ABI as an array of strings
 * @param args - Array of arguments to pass to the function calls
 * @param addresses - Array of contract addresses to call
 * @param fnName - The name of the function to call on each contract
 * @returns Promise that resolves to the results of all contract calls
 */
export async function batchContractCalls(
  network: string,
  provider: StaticJsonRpcProvider,
  abi: string[],
  args: any[],
  addresses: Address[],
  fnName: string
) {
  const multicall = new snapshot.utils.Multicaller(network, provider, abi);

  args.forEach((arg, i) => multicall.call(`${fnName}.${arg}`, addresses[i], fnName, [arg]));

  return (await multicall.execute())[fnName];
}
