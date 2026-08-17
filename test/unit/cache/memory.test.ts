import { MemoryStore, MemoryStoreOptions } from '../../../src/cache';

function store(options: Partial<MemoryStoreOptions> = {}) {
  return new MemoryStore({ maxEntries: 3, maxTtl: 60, cacheEmpty: false, ...options });
}

describe('cache/stores/memory', () => {
  describe('the entry bound', () => {
    it('holds no more than max, however many are written', async () => {
      const cache = store({ maxEntries: 10 });

      for (let i = 0; i < 1000; i++) {
        await cache.set(`key-${i}`, `value-${i}`);
      }

      const answered = await Promise.all(
        Array.from({ length: 1000 }, (_, i) => cache.get(`key-${i}`))
      );

      expect(answered.filter(value => value !== undefined)).toHaveLength(10);
    });

    it('evicts what has gone unread longest, not what was written first', async () => {
      const cache = store({ maxEntries: 3 });

      await cache.set('old-but-read', 'kept');
      await cache.set('old-and-unread', 'dropped');
      await cache.set('filler', 'filler');

      await cache.get('old-but-read');
      await cache.set('newest', 'newest');

      await expect(cache.get('old-but-read')).resolves.toBe('kept');
      await expect(cache.get('old-and-unread')).resolves.toBeUndefined();
    });
  });

  it('holds an entry no longer than the policy, whatever the caller asks for', async () => {
    const cache = store({ maxTtl: 60 });

    await cache.set('key', 'value', 86400);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 1e3);

    await expect(cache.get('key')).resolves.toBeUndefined();
  });

  describe('an empty answer', () => {
    it('is dropped when the policy does not cache empties', async () => {
      const cache = store({ cacheEmpty: false });

      await cache.set('key', '');

      await expect(cache.get('key')).resolves.toBeUndefined();
    });

    it('is kept when the policy caches empties', async () => {
      const cache = store({ cacheEmpty: true });

      await cache.set('key', '');

      await expect(cache.get('key')).resolves.toBe('');
    });
  });
});
