import redis from '../../helpers/redis';
import { CachePolicy, CacheStore } from '../types';

export type RedisStoreOptions = CachePolicy & {
  prefix: string;
};

export class RedisStore implements CacheStore {
  constructor(private readonly options: RedisStoreOptions) {}

  private prefixed(key: string): string {
    return `${this.options.prefix}:${key}`;
  }

  private expiry(ttl = this.options.maxTtl) {
    return { EX: Math.min(ttl, this.options.maxTtl) };
  }

  private stores(value: string): boolean {
    return !!value || this.options.cacheEmpty;
  }

  async get(key: string): Promise<string | undefined> {
    if (!redis) return undefined;

    return (await redis.get(this.prefixed(key))) ?? undefined;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    if (!redis) return {};

    const transaction = redis.multi();
    keys.forEach(key => transaction.get(this.prefixed(key)));
    const results = await transaction.exec();

    return Object.fromEntries(
      keys.map((key, index) => [key, results[index]]).filter(([, value]) => value !== null)
    );
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!redis || !this.stores(value)) return;

    await redis.set(this.prefixed(key), value || '', this.expiry(ttl));
  }

  async setMany(values: Record<string, string>, ttl?: number): Promise<void> {
    if (!redis) return;

    const transaction = redis.multi();
    Object.entries(values)
      .filter(([, value]) => this.stores(value))
      .forEach(([key, value]) =>
        transaction.set(this.prefixed(key), value || '', this.expiry(ttl))
      );

    await transaction.exec();
  }

  async delete(key: string): Promise<boolean> {
    if (!redis) return false;

    return (await redis.del(this.prefixed(key))) > 0;
  }
}
