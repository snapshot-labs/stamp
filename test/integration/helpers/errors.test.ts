import { isSilencedError } from '../../../src/helpers/errors';

describe('isSilencedError', () => {
  it('silences a wrapped ethers 504 (CALL_EXCEPTION around SERVER_ERROR)', () => {
    // Shape observed from Sentry STAMP-4B: JsonRpcProvider.checkError wraps the
    // original SERVER_ERROR as error.error and re-throws with code CALL_EXCEPTION.
    const wrapped = {
      message:
        'missing revert data in call exception; Transaction reverted without a reason string',
      code: 'CALL_EXCEPTION',
      error: {
        message:
          'bad response (status=504, headers={}, body="error code: 504", code=SERVER_ERROR, version=web/5.7.1)',
        code: 'SERVER_ERROR',
        status: 504
      }
    };

    expect(isSilencedError(wrapped)).toBe(true);
  });

  it('does not throw when nested status is a number with no code', () => {
    const wrapped = { error: { status: 504 } };
    expect(() => isSilencedError(wrapped)).not.toThrow();
    expect(isSilencedError(wrapped)).toBe(true);
  });

  it.each([null, undefined, false])('silences a rejection carrying %p', value => {
    expect(isSilencedError(value)).toBe(true);
  });

  it('silences a 504 carried on error.response', () => {
    // Shape observed from Sentry STAMP-7. The previous `||` chain
    // short-circuited on error.code and never reached error.response.status.
    const upstreamError = {
      message: '[hub.snapshot.org] status code 504: Gateway Timeout',
      status: 504,
      response: { status: 504 }
    };

    expect(isSilencedError(upstreamError)).toBe(true);
  });

  it('silences undici fetch failures with transient socket causes', () => {
    const fetchError = new TypeError('fetch failed') as TypeError & {
      cause?: Error & { code?: string };
    };
    fetchError.cause = Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET'
    });

    expect(isSilencedError(fetchError)).toBe(true);
  });

  it('silences errors matched by cause message', () => {
    const fetchError = new TypeError('fetch failed') as TypeError & {
      cause?: Error;
    };
    fetchError.cause = new Error('bad response status=504');

    expect(isSilencedError(fetchError)).toBe(true);
  });

  it('silences a rate limit carrying its HTTP status', () => {
    const rateLimited = Object.assign(
      new Error('Unstoppable Domains API error: HTTP 429 Too Many Requests'),
      { status: 429 }
    );

    expect(isSilencedError(rateLimited)).toBe(true);
  });

  it('silences a gateway timeout carrying its HTTP status', () => {
    const gatewayTimeout = Object.assign(
      new Error('Unstoppable Domains API error: HTTP 504 Gateway Timeout'),
      { status: 504 }
    );

    expect(isSilencedError(gatewayTimeout)).toBe(true);
  });

  it('does not silence other HTTP statuses carried on the error', () => {
    const unauthorized = Object.assign(
      new Error('Unstoppable Domains API error: HTTP 401 Unauthorized'),
      { status: 401 }
    );

    expect(isSilencedError(unauthorized)).toBe(false);
  });

  it('silences a 429 carried on error.response', () => {
    const upstreamError = {
      message: '[api.lens.xyz] status code 429: Too Many Requests',
      status: 429,
      response: { status: 429 }
    };

    expect(isSilencedError(upstreamError)).toBe(true);
  });

  it('does not silence a non-transient status carried on error.response', () => {
    const upstreamError = {
      message: '[hub.snapshot.org] status code 500: Internal Server Error',
      status: 500,
      response: { status: 500 }
    };

    expect(isSilencedError(upstreamError)).toBe(false);
  });

  it('silences transient SERVFAIL DNS server status (2)', () => {
    // @webinterop/dns-connect throws "Received error status from DNS server: N"
    // for non-zero RCODEs. Status 2 (SERVFAIL) is a transient external-resolver
    // failure. See STAMP-36.
    expect(isSilencedError(new Error('Received error status from DNS server: 2.'))).toBe(true);
  });

  it('does not silence other DNS server statuses (e.g. FORMERR)', () => {
    // Status 1 (FORMERR) indicates a malformed query on our side — keep it visible.
    expect(isSilencedError(new Error('Received error status from DNS server: 1.'))).toBe(false);
  });
});
