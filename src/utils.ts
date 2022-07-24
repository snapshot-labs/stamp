import { createHash } from 'crypto';
import sharp from 'sharp';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import snapshot from '@snapshot-labs/snapshot.js';
import constants from './constants.json';

export function sha256(str) {
  return createHash('sha256')
    .update(str)
    .digest('hex');
}

export async function resize(input, w, h, fit = 'cover') {
  return sharp(input)
    .resize(w, h, {
      fit
    })
    .webp({ lossless: true })
    .toBuffer();
}

export async function parseQuery(id, type, query) {
  let address = id;
  let network = '1';

  // Resolve format
  let format;
  const chunks = id.split(':');
  if (chunks.length === 2) {
    format = 'eip3770';
    address = chunks[1];
  } else if (chunks.length === 3) {
    format = 'caip10';
    address = chunks[2];
    network = chunks[1];
  } else if (id.startsWith('did:')) {
    format = 'did';
    address = id.slice(4);
  }
  // console.log('Format', format);

  // Resolve ENS name
  if (address.includes('.') && type !== 'space') {
    const provider = new StaticJsonRpcProvider('https://brovider.xyz/1');
    const addressFromEns = await provider.resolveName(address);
    if (addressFromEns) address = addressFromEns;
  }

  address = address.toLowerCase();
  const size = 64;
  const maxSize = 500;
  let s = query.s ? parseInt(query.s) : size;
  if (s < 1 || s > maxSize || isNaN(s)) s = size;
  let w = query.w ? parseInt(query.w) : s;
  if (w < 1 || w > maxSize || isNaN(w)) w = size;
  let h = query.h ? parseInt(query.h) : s;
  if (h < 1 || h > maxSize || isNaN(h)) h = size;

  return {
    address,
    network,
    w,
    h,
    fallback: query.fb === 'jazzicon' ? 'jazzicon' : 'blockie'
  };
}

export function chainIdToName(chainId: string) {
  if (chainId === '1') return 'ethereum';
  if (chainId === '56') return 'binance';
  if (chainId === '250') return 'fantom';
  if (chainId === '137') return 'polygon';
  if (chainId === '42161') return 'arbitrum';

  return null;
}

export function getUrl(url) {
  const gateway: string = process.env.IPFS_GATEWAY || 'snapshot.mypinata.cloud';
  return snapshot.utils.getUrl(url, gateway);
}

export function getCacheKey({
  type,
  network,
  address,
  subId,
  w,
  h,
  fallback
}: {
  type: string;
  network: string;
  address: string;
  subId?: string;
  w: number;
  h: number;
  fallback: string;
}) {
  if (fallback === 'blockie') return sha256(JSON.stringify({ type, network, address, w, h }));
  const blob: Record<string, any> = { type, network, address, w, h, fallback };
  if (type === 'nft') blob.tokenId = subId;

  return sha256(JSON.stringify(blob));
}

export function setHeader(res) {
  res.set({
    'Content-Type': 'image/webp',
    'Cache-Control': `public, max-age=${constants.ttl}`,
    Expires: new Date(Date.now() + constants.ttl * 1e3).toUTCString()
  });
}
