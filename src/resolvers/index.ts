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

// The catch keeps what each resolver had around its own resize call: bytes
// sharp refuses answer false rather than throwing into the image route, which
// has no guard of its own (#495). Entries with resize: false hand their bytes
// to the bare resize() in api.ts and stay exposed to that gap.
function withResize(resolve: ResolverFn): ResolverFn {
  return async (...args) => {
    const input = await resolve(...args);
    if (!input) return false;

    try {
      return await resize(input, max, max);
    } catch (err) {
      capture(err);
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

type ResolverName = (typeof RESOLVERS)[number]['name'];

// Object.fromEntries types its result as Record<string, ...>, which compiles
// everywhere and silently drops the name check that api.ts and the integration
// helper rely on. The cast is what keeps the keys a literal union.
export default Object.fromEntries(
  RESOLVERS.map(entry => [entry.name, entry.resize ? withResize(entry.fn) : entry.fn])
) as Record<ResolverName, ResolverFn>;
