import { createHash } from 'crypto';
import { Response } from 'express';
import { z } from 'zod';
import constants from '../constants.json';
import { chainIdToShortName, shortNameToChainId } from './chains';
import { RESIZE_FITS } from './image';
import { ResolverType } from './types';

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

const DEFAULT_SIZE = 64;

function dimension(max: number) {
  return z
    .preprocess(v => (v ? parseInt(v as string) : undefined), z.number().min(1).max(max).optional())
    .catch(DEFAULT_SIZE);
}

function imageQuerySchema(type: ResolverType, resolvers: string[]) {
  const max = type.includes('-cover') ? constants.maxCover : constants.max;

  return z.object({
    s: dimension(max).transform(s => s ?? DEFAULT_SIZE),
    w: dimension(max),
    h: dimension(max),
    fb: z.enum(['blockie', 'jazzicon']).catch('blockie'),
    cb: z.any(),
    fit: z.enum(RESIZE_FITS).optional().catch(undefined),
    resolver: z.preprocess(
      v => v || undefined,
      z.enum(resolvers as [string, ...string[]]).optional()
    )
  });
}

export function parseQuery(id: string, type: ResolverType, query) {
  id = id.trim().toLowerCase();
  let address = id;
  let network = '1';
  let networkId: string | undefined = undefined;
  const chunks = id.split(':').map(chunk => chunk.trim());
  if (chunks.length === 2) {
    address = chunks[1];
    networkId = chunks[0];
    network = shortNameToChainId(networkId) || '1';
  } else if (chunks.length === 3) {
    address = chunks[2];
    network = chunks[1];
    networkId = chainIdToShortName(network) || 'eth';
  }

  address = address.toLowerCase();
  const typeResolvers: string[] =
    constants.resolvers[type as keyof typeof constants.resolvers] ?? constants.resolvers.avatar;
  const { s, w, h, fb, cb, fit, resolver } = imageQuerySchema(type, typeResolvers).parse(query);

  return {
    address,
    network,
    networkId,
    w: w ?? s,
    h: h ?? s,
    fallback: fb as string,
    cb,
    resolver,
    resolvers: resolver ? [resolver] : typeResolvers,
    fit
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

export function getBaseCacheKey(
  type: ResolverType,
  { network, address, fallback, cb, fit }: ReturnType<typeof parseQuery>
) {
  return getCacheKey({
    type,
    network,
    address,
    w: constants.max,
    h: constants.max,
    fallback,
    cb,
    fit
  });
}

export function setHeader(res: Response, cacheType: 'SHORT_CACHE' | 'LONG_CACHE' = 'LONG_CACHE') {
  const ttl = cacheType === 'SHORT_CACHE' ? constants.shortTtl : constants.ttl;
  res.set({
    'Content-Type': 'image/webp',
    'Cache-Control': `public, max-age=${ttl}`,
    Expires: new Date(Date.now() + ttl * 1e3).toUTCString()
  });
}
