import { DNSConnect, DNSConnectCacheProvider } from '@webinterop/dns-connect';

// Not dns-connect's own InMemoryCache: that one arms a ref'd setTimeout per entry to
// evict it, and the TLD registration status it writes on every resolve() carries a
// one-day TTL, so a single resolution keeps the Node process alive for 24 hours after
// the work is done. Expiring on read instead needs no timer and answers the same.
class ExpiringCache implements DNSConnectCacheProvider {
  private entries = new Map<string, { value: string; expiresAt: number }>();

  async set(key: string, value: string, ttl: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttl * 1e3 });
  }

  async get(key: string): Promise<string | undefined> {
    const entry = this.entries.get(key);

    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export function dnsConnect(forwarderDomain: string): DNSConnect {
  return new DNSConnect({
    dns: { forwarderDomain },
    caching: { cacheProvider: new ExpiringCache() }
  });
}
