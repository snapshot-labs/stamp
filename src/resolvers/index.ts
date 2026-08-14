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

// Normalizing to a max x max webp is pipeline work, not resolver work: a
// resolver finds the bytes, the map normalizes them. The resize keeps the catch
// it had inside each wrapped resolver, so hostile bytes from those entries
// answer false rather than throwing into the unguarded image route in api.ts.
// The cover/logo entries below skip this wrapper and remain exposed to that
// same gap (pre-existing, tracked in #495).
function withResize<T extends unknown[]>(
  resolve: (...args: T) => Promise<Buffer | false>
): (...args: T) => Promise<Buffer | false> {
  return async (...args: T) => {
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

// Two groups of entries deliberately opt out of the resize:
//   - covers and logos ('user-cover', 'space-cover', 'space-logo',
//     'space-cover-sx') skip the shared resize so the base cache keeps its
//     upstream aspect ratio; api.ts still resizes every response to the
//     request's w x h (default 64x64) before serving it. resize() passes
//     no options, so sharp falls back to fit: 'cover', which would center-crop a
//     1500x500 banner into a 500x500 square; parseQuery gives the '-cover'
//     types (user-cover, space-cover, space-cover-sx) their own, larger
//     ceiling (constants.maxCover) for the same reason. space-logo keeps the
//     default constants.max ceiling but is still excluded here so its aspect
//     ratio isn't force-cropped to a square.
//   - blockie and jazzicon are the fallbacks api.ts feeds straight into resize(),
//     so they stay out of the false-on-failure contract and resize themselves.
export default {
  blockie,
  jazzicon,
  ens: withResize(ens),
  basename: withResize(basename),
  trustwallet: withResize(trustwallet),
  coingecko: withResize(coingecko),
  snapshot: withResize(sResolveUserAvatar),
  'user-cover': sResolveUserCover,
  space: withResize(sResolveSpaceAvatar),
  'space-cover': sResolveSpaceCover,
  'space-logo': sResolveSpaceLogo,
  'space-sx': withResize(sxResolveAvatar),
  'space-cover-sx': sxResolveCover,
  selfid: withResize(selfid),
  lens: withResize(lens),
  starknet: withResize(starknet),
  farcaster: withResize(farcaster)
};
