import * as sentry from '@snapshot-labs/snapshot-sentry';
import { RedisStore } from '../../../../src/cache';
import redis from '../../../../src/helpers/redis';
import cache, {
  getCache,
  markNonCacheable,
  setCache
} from '../../../../src/resolvers/address/cache';

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const FAILED_ADDRESS = '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1';
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000001';
const KEY = `address-resolvers:${ADDRESS}`;
const TTL = 43200;

// Written out rather than derived from KEY_PREFIX and constants.ttl: derived, this would
// pass symmetrically and check nothing.
describe('address resolvers cache', () => {
  beforeEach(() => redis?.flushDb());
  afterEach(() => jest.restoreAllMocks());

  it('stores an answer under its own key for twelve hours', async () => {
    await setCache({ [ADDRESS]: 'less.eth' });

    await expect(redis?.get(KEY)).resolves.toBe('less.eth');

    const ttl = await redis?.ttl(KEY);

    expect(ttl).toBeGreaterThan(TTL - 10);
    expect(ttl).toBeLessThanOrEqual(TTL);
  });

  it('returns an answer before a cache write settles and reports a rejected write', async () => {
    const failure = new Error('redis write failed');
    let rejectWrite!: (error: Error) => void;
    let writeStarted!: () => void;
    const started = new Promise<void>(resolve => {
      writeStarted = resolve;
    });
    const write = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject;
    });
    jest.spyOn(RedisStore.prototype, 'setMany').mockImplementationOnce(() => {
      writeStarted();
      return write;
    });
    const capture = jest.spyOn(sentry, 'capture').mockReturnValue('' as any);

    let responseValue: Record<string, string> | undefined;
    let responseError: unknown;
    const response = cache([ADDRESS], async () => ({ [ADDRESS]: 'less.eth' }));
    const trackedResponse = response.then(
      value => {
        responseValue = value;
      },
      error => {
        responseError = error;
      }
    );

    await started;
    await new Promise(resolve => setImmediate(resolve));
    const settledBeforeWrite = responseValue !== undefined || responseError !== undefined;
    rejectWrite(failure);
    await trackedResponse;
    await new Promise(resolve => setImmediate(resolve));

    expect(settledBeforeWrite).toBe(true);
    expect(responseValue).toEqual({ [ADDRESS]: 'less.eth' });
    expect(responseError).toBeUndefined();
    expect(capture).toHaveBeenCalledWith(failure);
  });

  it('does not cache a rejected lookup beside cacheable results', async () => {
    await cache([ADDRESS, FAILED_ADDRESS, EMPTY_ADDRESS], async () =>
      markNonCacheable(
        {
          [ADDRESS]: 'less.eth',
          [FAILED_ADDRESS]: '',
          [EMPTY_ADDRESS]: ''
        },
        [FAILED_ADDRESS]
      )
    );

    await expect(getCache([ADDRESS, FAILED_ADDRESS, EMPTY_ADDRESS])).resolves.toEqual({
      [ADDRESS]: 'less.eth',
      [EMPTY_ADDRESS]: ''
    });
  });
});
