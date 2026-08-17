import { CachePolicy, CacheStore } from '../types';

export type MemoryStoreOptions = CachePolicy & {
  maxEntries: number;
};

type Entry = { value: string; expiresAt: number };

export class MemoryStore implements CacheStore {
  private entries = new Map<string, Entry>();

  constructor(private readonly options: MemoryStoreOptions) {}

  async get(key: string): Promise<string | undefined> {
    const entry = this.entries.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);

      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const values = await Promise.all(keys.map(key => this.get(key)));

    return Object.fromEntries(
      keys.map((key, index) => [key, values[index]]).filter(([, value]) => value !== undefined)
    );
  }

  async set(key: string, value: string, ttl = this.options.maxTtl): Promise<void> {
    if (!value && !this.options.cacheEmpty) return;

    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + Math.min(ttl, this.options.maxTtl) * 1e3
    });

    while (this.entries.size > this.options.maxEntries) {
      const [oldest] = this.entries.keys();

      this.entries.delete(oldest);
    }
  }

  async setMany(values: Record<string, string>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key, value, ttl);
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }
}
