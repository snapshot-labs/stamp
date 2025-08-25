import * as ensResolver from './ens';
import * as lensResolver from './lens';
import * as unstoppableDomainResolver from './unstoppableDomains';
import * as starknetResolver from './starknet';
import * as snapshotResolver from './snapshot';
import * as shibariumResolver from './shibarium';
import * as spaceIdResolver from './spaceId';
import cache, { clear } from './cache';
import {
  normalizeAddresses,
  normalizeHandles,
  withoutEmptyValues,
  mapOriginalInput,
  withoutEmptyAddress
} from './utils';
import { Address, Handle } from '../utils';
import { timeAddressResolverResponse as timeResponse } from '../helpers/metrics';

const RESOLVERS = [
  snapshotResolver,
  ensResolver,
  unstoppableDomainResolver,
  lensResolver,
  starknetResolver,
  shibariumResolver,
  spaceIdResolver
];
const MAX_LOOKUP_ADDRESSES = 50;
const MAX_RESOLVE_NAMES = 5;

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
            } catch (e) {}
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
