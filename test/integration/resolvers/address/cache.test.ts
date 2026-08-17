import redis from '../../../../src/helpers/redis';
import { setCache } from '../../../../src/resolvers/address/cache';

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const KEY = `address-resolvers:${ADDRESS}`;
const TTL = 43200;

// Written out rather than derived from KEY_PREFIX and constants.ttl: derived, this would
// pass symmetrically and check nothing.
describe('address resolvers cache', () => {
  beforeEach(() => redis?.flushDb());

  it('stores an answer under its own key for twelve hours', async () => {
    await setCache({ [ADDRESS]: 'less.eth' });

    await expect(redis?.get(KEY)).resolves.toBe('less.eth');

    const ttl = await redis?.ttl(KEY);

    expect(ttl).toBeGreaterThan(TTL - 10);
    expect(ttl).toBeLessThanOrEqual(TTL);
  });
});
