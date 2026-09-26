import { Readable } from 'stream';
import { capture } from '@snapshot-labs/snapshot-sentry';
import basename from './basename';
import blockie from './blockie';
import cache, { clear } from './cache';
import defillama from './defillama';
import ens from './ens';
import farcaster from './farcaster';
import jazzicon from './jazzicon';
import lens from './lens';
import { parseQuery } from './query';
import {
  resolveSpaceAvatar as sResolveSpaceAvatar,
  resolveSpaceCover as sResolveSpaceCover,
  resolveSpaceLogo as sResolveSpaceLogo,
  resolveUserAvatar as sResolveUserAvatar,
  resolveUserCover as sResolveUserCover
} from './snapshot';
import { resolveAvatar as sxResolveAvatar, resolveCover as sxResolveCover } from './space-sx';
import starknet from './starknet';
import trustwallet from './trustwallet';
import { max } from '../../constants.json';
import { isSilencedError, isTransportFailure } from '../../helpers/errors';
import { isUnsupportedImageError, resize } from '../../helpers/image';
import { ResolverType } from '../../helpers/types';

type ResolverFn = (...args: any[]) => Promise<Buffer | false>;

type Resolver = {
  name: string;
  fn: ResolverFn;
  resize: boolean;
  failureContract: boolean;
};

// 401/402/403 are excluded from the routine band: withFailureContract wraps a
// resolver's own authenticated API calls (Neynar, Snapshot Hub)
// as well as its third-party avatar download, and those statuses are how a
// dead/rotated credential shows up there — silencing them hides a real outage
// instead of a missing avatar.
const AUTH_STATUS_CODES = [401, 402, 403];

function isRoutineMiss(error: any): boolean {
  const status = Number(error?.status ?? error?.response?.status);

  return (
    (status >= 400 && status < 500 && !AUTH_STATUS_CODES.includes(status)) ||
    isTransportFailure(error)
  );
}

function withFailureContract(name: string, resolve: ResolverFn): ResolverFn {
  return async (...args) => {
    try {
      return await resolve(...args);
    } catch (err) {
      if (!isSilencedError(err) && !isRoutineMiss(err)) {
        capture(err, { tags: { provider: name }, contexts: { input: { args } } });
      }
      return false;
    }
  };
}

function withResize(name: string, resolve: ResolverFn): ResolverFn {
  return async (...args) => {
    const input = await resolve(...args);
    if (!input) return false;

    try {
      return await resize(input, max, max);
    } catch (err) {
      // The host served no image: the routine miss a 404 already is.
      if (isUnsupportedImageError(err)) return false;

      // A top-level `input` beside `tags` is dropped rather than wrapped.
      capture(err, { tags: { provider: name }, contexts: { input: { args } } });
      return false;
    }
  };
}

// blockie and jazzicon resize themselves.
export const RESOLVERS = [
  { name: 'blockie', fn: blockie, resize: false, failureContract: false },
  { name: 'jazzicon', fn: jazzicon, resize: false, failureContract: false },
  { name: 'ens', fn: ens, resize: true, failureContract: true },
  { name: 'basename', fn: basename, resize: true, failureContract: true },
  { name: 'trustwallet', fn: trustwallet, resize: true, failureContract: true },
  { name: 'defillama', fn: defillama, resize: true, failureContract: true },
  { name: 'snapshot', fn: sResolveUserAvatar, resize: true, failureContract: true },
  { name: 'user-cover', fn: sResolveUserCover, resize: false, failureContract: true },
  { name: 'space', fn: sResolveSpaceAvatar, resize: true, failureContract: true },
  { name: 'space-cover', fn: sResolveSpaceCover, resize: false, failureContract: true },
  { name: 'space-logo', fn: sResolveSpaceLogo, resize: false, failureContract: true },
  { name: 'space-sx', fn: sxResolveAvatar, resize: true, failureContract: true },
  { name: 'space-cover-sx', fn: sxResolveCover, resize: false, failureContract: true },
  { name: 'lens', fn: lens, resize: true, failureContract: true },
  { name: 'starknet', fn: starknet, resize: true, failureContract: true },
  { name: 'farcaster', fn: farcaster, resize: true, failureContract: true }
] as const satisfies readonly Resolver[];

// Returning E['fn'] here lets a caller treat a wrapped resolver as one that
// never answers false.
type ResolverMap = {
  [E in (typeof RESOLVERS)[number] as E['name']]: (
    ...args: Parameters<E['fn']>
  ) => Promise<Buffer | false>;
};

// Without the cast Object.fromEntries widens the keys to string.
const resolvers = Object.fromEntries(
  RESOLVERS.map(entry => {
    const resolve = entry.resize ? withResize(entry.name, entry.fn) : entry.fn;

    return [entry.name, entry.failureContract ? withFailureContract(entry.name, resolve) : resolve];
  })
) as ResolverMap;

export default resolvers;

export async function resolveImage(
  type: ResolverType,
  id: string,
  rawQuery: any
): Promise<{ image: Buffer | Readable; isFallback: boolean }> {
  const query = parseQuery(id, type, rawQuery);
  const {
    address,
    network,
    networkId,
    w,
    h,
    fallback,
    resolver,
    resolvers: currentResolvers,
    fit
  } = query;

  const image = await cache(
    type,
    query,
    async () => {
      const files = await Promise.all(
        currentResolvers.map(r => resolvers[r](address, network, networkId))
      );
      return files.find(Boolean) || false;
    },
    !!resolver
  );
  if (image) return { image, isFallback: false };

  const fallbackImage = await resolvers[fallback](address, network, networkId);
  return { image: await resize(fallbackImage, w, h, { fit }), isFallback: true };
}

export function clearCache(type: ResolverType, id: string, rawQuery: any) {
  const { fb, cb, fit } = rawQuery;
  return clear(type, parseQuery(id, type, { fb, cb, fit }));
}
