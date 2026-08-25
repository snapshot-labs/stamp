import { createHash } from 'crypto';
import { Response } from 'express';
import constants from '../constants.json';
import { chainIdToShortName, shortNameToChainId } from './chains';
import { RESIZE_FITS } from './image';
import { ResolverType } from './types';

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

export function parseQuery(id: string, type: ResolverType, query) {
  let address = id;
  let network = '1';
  let networkId: string | undefined = undefined;
  const chunks = id.split(':');
  if (chunks.length === 2) {
    address = chunks[1];
    networkId = chunks[0];
    network = shortNameToChainId(networkId) || '1';
  } else if (chunks.length === 3) {
    address = chunks[2];
    network = chunks[1];
    networkId = chainIdToShortName(network) || 'eth';
  }

  address = address.trim().toLowerCase();
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
