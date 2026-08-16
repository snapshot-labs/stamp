import { capture } from '@snapshot-labs/snapshot-sentry';
import { max } from '../constants.json';
import { resize } from '../utils';
import basename from './basename';
import blockie from './blockie';
import coingecko from './coingecko';
import ens from './ens';
import farcaster from './farcaster';
import jazzicon from './jazzicon';
import lens from './lens';
import selfid from './selfid';
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

type ResolverFn = (...args: any[]) => Promise<Buffer | false>;

type Resolver = {
  name: string;
  fn: ResolverFn;
  resize: boolean;
};

function withResize(name: string, resolve: ResolverFn): ResolverFn {
  return async (...args) => {
    let input: Buffer | false;

    try {
      input = await resolve(...args);
    } catch {
      // Silent on purpose: capturing here reports every routine upstream 404.
      return false;
    }

    if (!input) return false;

    try {
      return await resize(input, max, max);
    } catch (err) {
      // A top-level `input` beside `tags` is dropped rather than wrapped.
      capture(err, { tags: { provider: name }, contexts: { input: { args } } });
      return false;
    }
  };
}

// Covers and logos take resize: false so the base cache keeps its upstream
// aspect ratio: resize() passes no fit option, so sharp center-crops, and a
// banner cached as a square can never be served wide again (api.ts resizes
// every response to the requested w x h regardless).
// blockie and jazzicon take it for a different reason: api.ts feeds their
// result straight into resize(), so they resize themselves and must never
// answer false.
const RESOLVERS = [
  { name: 'blockie', fn: blockie, resize: false },
  { name: 'jazzicon', fn: jazzicon, resize: false },
  { name: 'ens', fn: ens, resize: true },
  { name: 'basename', fn: basename, resize: true },
  { name: 'trustwallet', fn: trustwallet, resize: true },
  { name: 'coingecko', fn: coingecko, resize: true },
  { name: 'snapshot', fn: sResolveUserAvatar, resize: true },
  { name: 'user-cover', fn: sResolveUserCover, resize: false },
  { name: 'space', fn: sResolveSpaceAvatar, resize: true },
  { name: 'space-cover', fn: sResolveSpaceCover, resize: false },
  { name: 'space-logo', fn: sResolveSpaceLogo, resize: false },
  { name: 'space-sx', fn: sxResolveAvatar, resize: true },
  { name: 'space-cover-sx', fn: sxResolveCover, resize: false },
  { name: 'selfid', fn: selfid, resize: true },
  { name: 'lens', fn: lens, resize: true },
  { name: 'starknet', fn: starknet, resize: true },
  { name: 'farcaster', fn: farcaster, resize: true }
] as const satisfies readonly Resolver[];

// Returning E['fn'] here lets a caller treat a wrapped resolver as one that
// never answers false.
type ResolverMap = {
  [E in (typeof RESOLVERS)[number] as E['name']]: (
    ...args: Parameters<E['fn']>
  ) => Promise<Buffer | false>;
};

// Without the cast Object.fromEntries widens the keys to string.
export default Object.fromEntries(
  RESOLVERS.map(entry => [entry.name, entry.resize ? withResize(entry.name, entry.fn) : entry.fn])
) as ResolverMap;
