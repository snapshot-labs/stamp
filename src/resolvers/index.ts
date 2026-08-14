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

// The catch keeps what each resolver had around its own resize call: bytes
// sharp refuses answer false rather than throwing into the image route, which
// has no guard of its own (#495). The unwrapped entries below hand their bytes
// to the bare resize() in api.ts and stay exposed to that gap.
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

// Covers and logos opt out so the base cache keeps its upstream aspect ratio:
// resize() passes no fit option, so sharp center-crops, and a banner cached as
// a square can never be served wide again (api.ts resizes every response to the
// requested w x h regardless).
// blockie and jazzicon opt out because api.ts feeds their result straight into
// resize(): they resize themselves and must never answer false.
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
