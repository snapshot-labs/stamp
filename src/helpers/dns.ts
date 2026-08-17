import { DNSConnect, DNSConnectCacheProvider } from '@webinterop/dns-connect';
import { CacheStore, MemoryStore } from '../cache';

const ONE_DAY = 86400;
const MAX_ENTRIES = 5000;

const stores = new Map<string, CacheStore>();

function storeFor(forwarderDomain: string): CacheStore {
  const existing = stores.get(forwarderDomain);

  if (existing) return existing;

  const store = new MemoryStore({
    maxEntries: MAX_ENTRIES,
    maxTtl: ONE_DAY,
    cacheEmpty: false
  });
  stores.set(forwarderDomain, store);

  return store;
}

function cacheProvider(store: CacheStore): DNSConnectCacheProvider {
  return {
    get: key => store.get(key),
    set: (key, value, ttl) => store.set(key, value, ttl),
    delete: async key => {
      await store.delete(key);
    }
  };
}

export function dnsConnect(forwarderDomain: string): DNSConnect {
  return new DNSConnect({
    dns: { forwarderDomain },
    caching: { cacheProvider: cacheProvider(storeFor(forwarderDomain)) }
  });
}
