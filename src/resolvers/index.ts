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
import zapper from './zapper';

export default {
  blockie,
  jazzicon,
  ens,
  trustwallet,
  coingecko,
  snapshot: sResolveUserAvatar,
  'user-cover': sResolveUserCover,
  space: sResolveSpaceAvatar,
  'space-cover': sResolveSpaceCover,
  'space-logo': sResolveSpaceLogo,
  'space-sx': sxResolveAvatar,
  'space-cover-sx': sxResolveCover,
  selfid,
  lens,
  zapper,
  starknet,
  farcaster
};
