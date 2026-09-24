import { RedisStore } from '../../cache';
import constants from '../../constants.json';
import { addressResolversCacheHitCount } from '../../helpers/metrics';

export const KEY_PREFIX = 'address-resolvers';

const stores: Record<string, RedisStore> = {};

// Mainnet keeps the unscoped prefix so entries cached before chains were supported stay valid.
function getStore(chainId: string): RedisStore {
  stores[chainId] ??= new RedisStore({
    prefix: chainId === '1' ? KEY_PREFIX : `${KEY_PREFIX}:${chainId}`,
    maxTtl: constants.ttl,
    cacheEmpty: true
  });
  return stores[chainId];
}

export function getCache(keys: string[], chainId = '1'): Promise<Record<string, string>> {
  return getStore(chainId).getMany(keys);
}

export function setCache(payload: Record<string, string>, chainId = '1'): Promise<void> {
  return getStore(chainId).setMany(payload);
}

export default async function cache(input: string[], chainId: string, callback) {
  const cache = await getCache(input, chainId);
  const cachedKeys = Object.keys(cache);
  const uncachedInputs = input.filter(a => !cachedKeys.includes(a));

  addressResolversCacheHitCount.inc({ status: 'MISS' }, uncachedInputs.length);
  addressResolversCacheHitCount.inc({ status: 'HIT' }, cachedKeys.length);

  if (uncachedInputs.length > 0) {
    const results = await callback(uncachedInputs);
    setCache(results, chainId);

    return { ...cache, ...results };
  }

  return cache;
}

export function clear(input: string): Promise<boolean> {
  // TODO: When redis is not available, it should probably throw instead of returning false
  // causing the api the return "failed to clear cache" instead of "not found"
  return getStore('1').delete(input);
}
