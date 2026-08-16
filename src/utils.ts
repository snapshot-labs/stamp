import { createHash } from 'crypto';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import snapshot from '@snapshot-labs/snapshot.js';
import axios, { AxiosResponse } from 'axios';
import { decodeHTMLStrict } from 'entities';
import { Response } from 'express';
import sharp from 'sharp';
import chains from './chains.json';
import constants from './constants.json';

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

const UPSTREAM_TIMEOUT = 10000;

// `isSilencedError` reads the error name, and the two ways to abort raise
// different ones: `AbortController` gives `AbortError`, `AbortSignal.timeout`
// gives `TimeoutError`.
export async function withDeadline<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

// For a callee that takes no signal of its own. This bounds the wait rather
// than the request: the work already started keeps running, capped only by
// whatever timeout its own client has.
export function untilAborted<T>(signal: AbortSignal, work: Promise<T>): Promise<T> {
  const aborted = new Promise<never>((_, reject) => {
    if (signal.aborted) return reject(signal.reason);

    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

  return Promise.race([work, aborted]);
}

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

function isUndefinedEntityError(err: unknown): boolean {
  return err instanceof Error && /Entity '[^']+' not defined/.test(err.message);
}

// XML defines these five itself, so they are never the name the parser
// rejected. Decoding them would edit a part of the document that was not
// broken, and turn escaped text back into markup on the way out.
const XML_ENTITY_NAMES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

// Sections where a name is literal text rather than a reference: comments,
// CDATA, and processing instructions, which librsvg does act on. Held as a
// source string so the declaration scan and the rewrite skip the same things;
// a declaration quoted inside one of these is not a declaration.
const SKIPPED_SECTIONS = '<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\?[\\s\\S]*?\\?>';

const SKIPPED = new RegExp(SKIPPED_SECTIONS, 'g');
const ENTITY_OR_SKIPPED = new RegExp(`${SKIPPED_SECTIONS}|&([A-Za-z][A-Za-z0-9]{0,31});`, 'g');

// An SVG naming any other entity needs an HTML DTD that libvips' XML parser
// never loads, so browsers render the file and sharp rejects the whole
// document. Rewriting the name to its numeric form is what makes it parse.
// A name the document declares for itself already resolves, so it is left
// alone too.
//
// Exported for the tests: which names this rewrites, and to what, is not
// observable through resize(), which renders a missing glyph and a wrong one
// identically.
export function numericizeHtmlEntities(svg: string): string {
  const declared = new Set(
    [...svg.replace(SKIPPED, '').matchAll(/<!ENTITY\s+([A-Za-z][A-Za-z0-9]*)\s/g)].map(
      match => match[1]
    )
  );

  return svg.replace(ENTITY_OR_SKIPPED, (match, name?: string) => {
    if (name === undefined || XML_ENTITY_NAMES.has(name) || declared.has(name)) return match;

    const decoded = decodeHTMLStrict(match);
    if (decoded === match) return match;

    return [...decoded].map(character => `&#${character.codePointAt(0)};`).join('');
  });
}

function toWebp(input, w, h, options?): Promise<Buffer> {
  return sharp(input).resize(w, h, options).webp().toBuffer();
}

export async function resize(input: Buffer, w, h, options?): Promise<Buffer> {
  try {
    return await toWebp(input, w, h, options);
  } catch (err) {
    if (!isUndefinedEntityError(err)) throw err;

    // latin1 is the byte to char map, so this round trip is lossless whatever
    // the document is encoded as. utf8 would replace every byte it cannot
    // decode, and the retry would then render mojibake rather than fail.
    const svg = input.toString('latin1');
    const rewritten = numericizeHtmlEntities(svg);
    if (rewritten === svg) throw err;

    try {
      return await toWebp(Buffer.from(rewritten, 'latin1'), w, h, options);
    } catch (retryErr) {
      // The retry parses a document we synthesised, so its error names an
      // entity the caller never sent. Report the one describing their input,
      // with the retry's failure attached as cause so it is not lost.
      (err as Error).cause = retryErr;
      throw err;
    }
  }
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

export type GraphQlResponse<T = any> = {
  data: T;
  errors?: { message?: string }[];
};

function graphQlEnvelopeError(url: string, status: number, message: string) {
  let source = url;
  try {
    source = new URL(url).host;
  } catch {
    // Not an absolute url; keep the whole string as the source.
  }

  // Both locations are load-bearing: isSilencedError reads `status` and
  // `response.status`, and a status only in the message string is unreachable to it.
  return Object.assign(new Error(`[${source}] ${message}`), {
    status,
    response: { status }
  });
}

export async function graphQlCall<T = any>(
  url: string,
  query: string,
  variables?: Record<string, any>,
  options: any = {
    headers: {}
  }
): Promise<AxiosResponse<GraphQlResponse<T>>> {
  const data: { query: string; variables?: Record<string, any> } = { query };
  if (variables) {
    data.variables = variables;
  }

  const response: AxiosResponse<GraphQlResponse<T>> = await axios({
    url: url,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(options.headers).filter(([, value]) => value !== undefined && value !== null)
      )
    },
    timeout: 5e3,
    data
  });

  const body = response.data;

  if (body?.errors?.length) {
    throw graphQlEnvelopeError(
      url,
      response.status,
      body.errors[0]?.message || 'GraphQL request failed'
    );
  }

  if (!body?.data) {
    throw graphQlEnvelopeError(url, response.status, 'GraphQL response has no data envelope');
  }

  return response;
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
