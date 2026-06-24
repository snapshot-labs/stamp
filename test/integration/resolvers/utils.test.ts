import { fetchHttpImage } from '../../../src/resolvers/utils';

describe('resolvers/utils', () => {
  describe('fetchHttpImage', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns a Buffer on a 2xx response', async () => {
      const bytes = Uint8Array.from([1, 2, 3]);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer
      }) as any;

      const result = await fetchHttpImage('https://example.com/image.png');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(Buffer.from(bytes));
    });

    it('throws on a non-2xx response instead of returning the error body as image bytes', async () => {
      // Native fetch resolves (does not reject) on 4xx/5xx. Without an
      // explicit response.ok check, a 404 body would be returned as a Buffer
      // and fed into sharp on cover/logo paths, 500-ing the request instead of
      // falling back. See PR #457 review (blocker).
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0)
      }) as any;

      await expect(fetchHttpImage('https://example.com/missing.png')).rejects.toThrow('404');
    });
  });
});
