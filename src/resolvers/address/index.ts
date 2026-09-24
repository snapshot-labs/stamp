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
import constants from '../../constants.json';
import {
  mapOriginalInput,
  normalizeAddresses,
  normalizeHandles,
  withoutEmptyAddress
} from '../../helpers/address';
import { isSilencedError, isTransportFailure } from '../../helpers/errors';
import { timeAddressResolverResponse as timeResponse } from '../../helpers/metrics';
import { withoutEmptyValues } from '../../helpers/object';
import { Address, Handle } from '../../helpers/types';

// A resolver may export MUTED_ERRORS, a list of extra error messages this
// resolver never wants reported (e.g. a flaky public API's own 5xx).
type Resolver = {
  NAME: string;
  MUTED_ERRORS?: string[];
  // Chains the resolver serves, defaulting to mainnet only.
  CHAIN_IDS?: string[];
  lookupAddresses: (addresses: Address[]) => Promise<Record<Address, Handle>>;
  resolveNames: (handles: Handle[], chainId: string) => Promise<Record<Handle, Address>>;
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

const servesChain = (r: Resolver, chainId: string) => (r.CHAIN_IDS ?? ['1']).includes(chainId);

// Answers differ per chain, so non-mainnet chains get their own cache keys.
function chainCache(chainId: string): typeof cache {
  if (chainId === '1') return cache;

  const prefix = `${chainId}:`;
  const scope = (record: Record<string, string>, fn: (key: string) => string) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [fn(key), value]));

  return async (input, callback) =>
    scope(
      await cache(
        input.map(key => prefix + key),
        async (keys: string[]) =>
          scope(await callback(keys.map(key => key.slice(prefix.length))), key => prefix + key)
      ),
      key => key.slice(prefix.length)
    );
}

async function _call(fnName: string, input: string[], maxInputLength: number, chainId = '1') {
  if (input.length > maxInputLength) {
    return Promise.reject({
      error: `params must contains less than ${maxInputLength} items`,
      code: 400
    });
  }

  if (input.length === 0) return {};

  return withoutEmptyAddress(
    withoutEmptyValues(
      await chainCache(chainId)(input, async (_input: string[]) => {
        const results = await Promise.all(
          RESOLVERS.filter(r => servesChain(r, chainId)).map(async r => {
            const end = timeResponse.startTimer({
              provider: r.NAME,
              method: fnName
            });
            let result = {};
            let status = 0;

            try {
              result = await r[fnName](_input, chainId);
              status = 1;
            } catch (err) {
              if (!isSilencedError(err, r.MUTED_ERRORS) && !isTransportFailure(err)) {
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
    constants.maxLookupAddresses
  );

  return mapOriginalInput(addresses, result);
}

// L2 spaces send their own chain id; a chain no resolver serves falls back to mainnet.
export async function resolveNames(
  handles: Handle[],
  network: unknown = '1'
): Promise<Record<Handle, Address>> {
  const chainId = String(network);
  const result = await _call(
    'resolveNames',
    Array.from(new Set(normalizeHandles(handles))),
    constants.maxResolveNames,
    RESOLVERS.some(r => servesChain(r, chainId)) ? chainId : '1'
  );

  return mapOriginalInput(handles, result);
}

export function clearCache(input: string, type: 'address' | 'name'): Promise<boolean> {
  return clear(type === 'address' ? normalizeAddresses([input])[0] : normalizeHandles([input])[0]);
}
