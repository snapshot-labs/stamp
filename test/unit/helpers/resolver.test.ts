import { capture } from '@snapshot-labs/snapshot-sentry';
import { callResolver } from '../../../src/helpers/resolver';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

const PROVIDER = 'Provider';
const INPUT = { address: '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6' };
const EMPTY = Symbol('empty');

const notFound = () => Object.assign(new Error('not found'), { status: 404 });

describe('callResolver', () => {
  it('returns the result and records status 1', async () => {
    const endTimer = jest.fn();

    await expect(
      callResolver<unknown>(async () => 'result', {
        provider: PROVIDER,
        input: INPUT,
        empty: EMPTY,
        endTimer
      })
    ).resolves.toBe('result');
    expect(endTimer).toHaveBeenCalledWith({ status: 1 });
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    ['a rejection carrying null', null, undefined, false],
    ['a rejection carrying undefined', undefined, undefined, false],
    [
      'a silenced error',
      Object.assign(new Error('rate limited'), { status: 429 }),
      undefined,
      false
    ],
    [
      'an upstream 5xx',
      Object.assign(new Error('down'), { response: { status: 500 } }),
      undefined,
      false
    ],
    ['an abort', Object.assign(new Error('aborted'), { name: 'AbortError' }), undefined, false],
    [
      'a host that no longer resolves',
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }),
      undefined,
      false
    ],
    [
      'an unresolvable host carried on error.code',
      Object.assign(new Error('getaddrinfo ENOTFOUND host'), { code: 'ENOTFOUND' }),
      undefined,
      false
    ],
    [
      'a TLS failure',
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } }),
      undefined,
      false
    ],
    ['a routine miss', notFound(), (): boolean => true, false],
    ['a plain upstream 4xx', notFound(), undefined, true],
    ['an error the routine-miss check rejects', notFound(), (): boolean => false, true],
    ['an unclassified error', new Error('boom'), undefined, true]
  ] as const)(
    'on %s, returns empty, records status 0 and reports=%s',
    async (_label, error, isRoutineMiss, reported) => {
      const endTimer = jest.fn();

      await expect(
        callResolver(() => Promise.reject(error), {
          provider: PROVIDER,
          input: INPUT,
          empty: EMPTY,
          isRoutineMiss,
          endTimer
        })
      ).resolves.toBe(EMPTY);
      expect(endTimer).toHaveBeenCalledTimes(1);
      expect(endTimer).toHaveBeenCalledWith({ status: 0 });
      if (reported) {
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture).toHaveBeenCalledWith(error, {
          tags: { provider: PROVIDER },
          contexts: { input: INPUT }
        });
      } else {
        expect(capture).not.toHaveBeenCalled();
      }
    }
  );

  it('works without an endTimer', async () => {
    await expect(
      callResolver(() => Promise.reject(new Error('boom')), {
        provider: PROVIDER,
        input: INPUT,
        empty: EMPTY
      })
    ).resolves.toBe(EMPTY);
  });
});
