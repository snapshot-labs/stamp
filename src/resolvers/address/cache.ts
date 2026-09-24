import { RedisStore } from '../../cache';
import constants from '../../constants.json';
import { addressResolversCacheHitCount } from '../../helpers/metrics';

export const KEY_PREFIX = 'address-resolvers';

const store = new RedisStore({ prefix: KEY_PREFIX, maxTtl: constants.ttl, cacheEmpty: true });

export function getCache(keys: string[]): Promise<Record<string, string>> {
  return store.getMany(keys);
}

export function setCache(payload: Record<string, string>): Promise<void> {
  return store.setMany(payload);
}

export default async function cache(input: string[], callback) {
  const cache = await getCache(input);
  const cachedKeys = Object.keys(cache);
  const uncachedInputs = input.filter(a => !cachedKeys.includes(a));

  addressResolversCacheHitCount.inc({ status: 'MISS' }, uncachedInputs.length);
  addressResolversCacheHitCount.inc({ status: 'HIT' }, cachedKeys.length);

  if (uncachedInputs.length > 0) {
    const results = await callback(uncachedInputs);
    setCache(results);

    return { ...cache, ...results };
  }

  return cache;
}

export function clear(input: string): Promise<boolean> {
  // TODO: When redis is not available, it should probably throw instead of returning false
  // causing the api the return "failed to clear cache" instead of "not found"
  return store.delete(input);
}
