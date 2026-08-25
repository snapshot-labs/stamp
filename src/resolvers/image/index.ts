import { capture } from '@snapshot-labs/snapshot-sentry';
import basename from './basename';
import blockie from './blockie';
import coingecko from './coingecko';
import ens from './ens';
import farcaster from './farcaster';
import jazzicon from './jazzicon';
import lens, { MUTED_ERRORS as lensMutedErrors } from './lens';
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
import { isRoutineMiss, isSilencedError } from '../../helpers/errors';
import { resize } from '../../helpers/image';

type ResolverFn = (...args: any[]) => Promise<Buffer | false>;

type Resolver = {
  name: string;
  fn: ResolverFn;
  resize: boolean;
  failureContract: boolean;
  mutedErrors?: string[];
};

function withFailureContract(
  name: string,
  resolve: ResolverFn,
  mutedErrors?: string[]
): ResolverFn {
  return async (...args) => {
    try {
      return await resolve(...args);
    } catch (err) {
      if (!isSilencedError(err, mutedErrors) && !isRoutineMiss(err)) {
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
  { name: 'coingecko', fn: coingecko, resize: true, failureContract: true },
  { name: 'snapshot', fn: sResolveUserAvatar, resize: true, failureContract: true },
  { name: 'user-cover', fn: sResolveUserCover, resize: false, failureContract: true },
  { name: 'space', fn: sResolveSpaceAvatar, resize: true, failureContract: true },
  { name: 'space-cover', fn: sResolveSpaceCover, resize: false, failureContract: true },
  { name: 'space-logo', fn: sResolveSpaceLogo, resize: false, failureContract: true },
  { name: 'space-sx', fn: sxResolveAvatar, resize: true, failureContract: true },
  { name: 'space-cover-sx', fn: sxResolveCover, resize: false, failureContract: true },
  {
    name: 'lens',
    fn: lens,
    resize: true,
    failureContract: true,
    mutedErrors: lensMutedErrors
  },
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
export default Object.fromEntries(
  RESOLVERS.map(entry => {
    const resolve = entry.resize ? withResize(entry.name, entry.fn) : entry.fn;

    return [
      entry.name,
      entry.failureContract
        ? withFailureContract(
            entry.name,
            resolve,
            'mutedErrors' in entry ? entry.mutedErrors : undefined
          )
        : resolve
    ];
  })
) as ResolverMap;
