import { capture } from '@snapshot-labs/snapshot-sentry';
import * as basenameResolver from './basename';
import cache, { clear } from './cache';
import * as ensResolver from './ens';
import * as gweiResolver from './gwei';
import * as lensResolver from './lens';
import * as shibariumResolver from './shibarium';
import * as snapshotResolver from './snapshot';
import * as spaceIdResolver from './spaceId';
import * as starknetResolver from './starknet';
import * as unstoppableDomainResolver from './unstoppableDomains';
import {
  isSilencedError,
  mapOriginalInput,
  normalizeAddresses,
  normalizeHandles,
  withoutEmptyAddress,
  withoutEmptyValues
} from '../../helpers/address';
import { timeAddressResolverResponse as timeResponse } from '../../helpers/metrics';
import { Address, Handle } from '../../utils';

// A resolver may export MUTED_ERRORS, a list of extra error messages this
// resolver never wants reported (e.g. a flaky public API's own 5xx).
type Resolver = {
  NAME: string;
  MUTED_ERRORS?: string[];
  lookupAddresses: (addresses: Address[]) => Promise<Record<Address, Handle>>;
  resolveNames: (handles: Handle[]) => Promise<Record<Handle, Address>>;
};

const RESOLVERS: Resolver[] = [
  snapshotResolver,
  ensResolver,
  basenameResolver,
  unstoppableDomainResolver,
  lensResolver,
  starknetResolver,
  shibariumResolver,
  spaceIdResolver,
  gweiResolver
];
export const MAX_LOOKUP_ADDRESSES = 50;
export const MAX_RESOLVE_NAMES = 5;

async function _call(fnName: string, input: string[], maxInputLength: number) {
  if (input.length > maxInputLength) {
    return Promise.reject({
      error: `params must contains less than ${maxInputLength} items`,
      code: 400
    });
  }

  if (input.length === 0) return {};

  return withoutEmptyAddress(
    withoutEmptyValues(
      await cache(input, async (_input: string[]) => {
        const results = await Promise.all(
          RESOLVERS.map(async r => {
            const end = timeResponse.startTimer({
              provider: r.NAME,
              method: fnName
            });
            let result = {};
            let status = 0;

            try {
              result = await r[fnName](_input);
              status = 1;
            } catch (err) {
              if (!isSilencedError(err, r.MUTED_ERRORS)) {
                // A top-level `input` beside `tags` is dropped rather than wrapped.
                capture(err, {
                  tags: { provider: r.NAME },
                  contexts: { input: { [fnName]: _input } }
                });
              }
            }
            end({ status });

            return result;
          })
        );

        return Object.fromEntries(
          _input.map(item => [item, results.map(r => r[item]).filter(i => !!i)[0] || ''])
        );
      })
    )
  );
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const result = await _call(
    'lookupAddresses',
    Array.from(new Set(normalizeAddresses(addresses))),
    MAX_LOOKUP_ADDRESSES
  );

  return mapOriginalInput(addresses, result);
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const result = await _call(
    'resolveNames',
    Array.from(new Set(normalizeHandles(handles))),
    MAX_RESOLVE_NAMES
  );

  return mapOriginalInput(handles, result);
}

export function clearCache(input: string, type: 'address' | 'name'): Promise<boolean> {
  return clear(type === 'address' ? normalizeAddresses([input])[0] : normalizeHandles([input])[0]);
}
