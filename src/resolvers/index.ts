import { capture } from '@snapshot-labs/snapshot-sentry';
import basename from './basename';
import blockie from './blockie';
import coingecko from './coingecko';
import ens, { MUTED_ERRORS as ENS_MUTED_ERRORS } from './ens';
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
import trustwallet, { MUTED_ERRORS as TRUSTWALLET_MUTED_ERRORS } from './trustwallet';
import zapper from './zapper';
import { isSilencedError } from '../addressResolvers/utils';

type ResolverFn = (...args: any[]) => Promise<Buffer | false>;

// A resolver returns false when it has no image for the input, and throws when
// it failed to find out. mutedErrors lists the extra error messages this
// resolver never wants reported (e.g. an asset CDN's 404 for a token it does
// not have); the always-silenced ones live in isSilencedError.
type Resolver = {
  name: string;
  fn: ResolverFn;
  mutedErrors?: string[];
};

const RESOLVERS: Resolver[] = [
  { name: 'blockie', fn: blockie },
  { name: 'jazzicon', fn: jazzicon },
  { name: 'ens', fn: ens, mutedErrors: ENS_MUTED_ERRORS },
  { name: 'basename', fn: basename },
  { name: 'trustwallet', fn: trustwallet, mutedErrors: TRUSTWALLET_MUTED_ERRORS },
  { name: 'coingecko', fn: coingecko },
  { name: 'snapshot', fn: sResolveUserAvatar },
  { name: 'user-cover', fn: sResolveUserCover },
  { name: 'space', fn: sResolveSpaceAvatar },
  { name: 'space-cover', fn: sResolveSpaceCover },
  { name: 'space-logo', fn: sResolveSpaceLogo },
  { name: 'space-sx', fn: sxResolveAvatar },
  { name: 'space-cover-sx', fn: sxResolveCover },
  { name: 'selfid', fn: selfid },
  { name: 'lens', fn: lens },
  { name: 'zapper', fn: zapper },
  { name: 'starknet', fn: starknet },
  { name: 'farcaster', fn: farcaster }
];

function withCapture({ name, fn, mutedErrors }: Resolver): ResolverFn {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (!isSilencedError(err, mutedErrors)) {
        capture(err, { input: { resolver: name, args } });
      }

      return false;
    }
  };
}

export default Object.fromEntries(
  RESOLVERS.map(resolver => [resolver.name, withCapture(resolver)])
) as Record<string, ResolverFn>;
