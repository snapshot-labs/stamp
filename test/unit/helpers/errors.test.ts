import { isSilencedError, isTransportFailure } from '../../../src/helpers/errors';

describe('isSilencedError', () => {
  it.each([500, 502, 503, 504, 521])('silences an RPC outage with status %s', status => {
    expect(
      isSilencedError({
        code: 'CALL_EXCEPTION',
        error: { code: 'SERVER_ERROR', status }
      })
    ).toBe(true);
  });

  it('keeps RPC rate limiting silenced', () => {
    expect(isSilencedError({ error: { status: 429 } })).toBe(true);
  });

  it('does not silence an RPC 400 response', () => {
    expect(
      isSilencedError({
        code: 'CALL_EXCEPTION',
        error: { code: 'SERVER_ERROR', status: 400 }
      })
    ).toBe(false);
  });

  it('keeps genuine execution reverts silenced', () => {
    expect(
      isSilencedError({
        code: 'CALL_EXCEPTION',
        reason: 'execution reverted',
        message: 'execution reverted'
      })
    ).toBe(true);
  });

  it.each([
    ['its own message', { message: 'execution reverted' }],
    ['a wrapped error', { error: { message: 'execution reverted' } }],
    ['its cause', { cause: { message: 'execution reverted' } }]
  ])('silences a known message carried by %s', (_, error) => {
    expect(isSilencedError(error)).toBe(true);
  });

  it('does not throw on a non-string message', () => {
    expect(isSilencedError({ message: 42, cause: { message: null } })).toBe(false);
  });

  it('does not silence unrelated errors', () => {
    expect(isSilencedError(new Error('boom'))).toBe(false);
  });

  it('classifies an error that is its own cause', () => {
    const error = new Error('boom');
    error.cause = error;

    expect(isSilencedError(error)).toBe(false);
  });

  it('does not throw when nested status is a number with no code', () => {
    const wrapped = { error: { status: 504 } };
    expect(() => isSilencedError(wrapped)).not.toThrow();
    expect(isSilencedError(wrapped)).toBe(true);
  });

  it.each([null, undefined, false])('silences a rejection carrying %p', value => {
    expect(isSilencedError(value)).toBe(true);
  });

  it('silences a transient errno carried on error.code', () => {
    expect(isSilencedError({ message: 'socket hang up', code: 'ECONNRESET' })).toBe(true);
  });

  it('silences a transient errno carried on a nested error.error.code', () => {
    expect(isSilencedError({ message: 'wrapped', error: { code: 'ETIMEDOUT' } })).toBe(true);
  });

  it('silences a 504 carried on error.response', () => {
    const upstreamError = {
      message: '[hub.snapshot.org] status code 504: Gateway Timeout',
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

  it('silences undici premature socket closes', () => {
    const fetchError = new TypeError('fetch failed') as TypeError & {
      cause?: Error & { code?: string };
    };
    fetchError.cause = Object.assign(new Error('Premature close'), {
      code: 'UND_ERR_SOCKET'
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
      response: { status: 429 }
    };

    expect(isSilencedError(upstreamError)).toBe(true);
  });

  it('silences a 5xx carried on error.response', () => {
    const upstreamError = {
      message: '[hub.snapshot.org] status code 500: Internal Server Error',
      response: { status: 500 }
    };

    expect(isSilencedError(upstreamError)).toBe(true);
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

  it('silences a viem RPC timeout nested under ContractFunctionExecutionError', () => {
    const timeoutMessage =
      'The request took too long to respond.\n\nDetails: The request timed out.';
    const timeoutError = Object.assign(new Error(timeoutMessage), { name: 'TimeoutError' });
    const callExecutionError = Object.assign(new Error(timeoutMessage), {
      name: 'CallExecutionError',
      cause: timeoutError
    });
    const contractFunctionExecutionError = Object.assign(
      new Error(
        'The request took too long to respond.\n\nContract Call:\n  function:  resolveWithGateways(bytes name, bytes data, string[] gateways)'
      ),
      { name: 'ContractFunctionExecutionError', cause: callExecutionError }
    );

    expect(isSilencedError(contractFunctionExecutionError)).toBe(true);
  });

  it('silences the real rejection fetch() produces for a port it refuses to open', async () => {
    const error = await fetch('http://example.com:25/x').catch(err => err);

    expect(error.cause?.message).toBe('bad port');
    expect(isSilencedError(error)).toBe(true);
  });

  it('silences a viem CCIP-Read gateway abort wrapped without a shortMessage', () => {
    const abortError = Object.assign(new Error('This operation was aborted'), {
      name: 'AbortError',
      code: 20
    });
    const contractFunctionExecutionError = Object.assign(
      new Error(
        'An unknown error occurred while executing the contract function "resolveWithGateways".\n\n\nDetails: This operation was aborted\nVersion: viem@2.55.13'
      ),
      { name: 'ContractFunctionExecutionError', cause: abortError }
    );

    expect(isSilencedError(contractFunctionExecutionError)).toBe(true);
  });
});

describe('isTransportFailure', () => {
  it.each(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'])(
    'treats a %s errno as one',
    code => {
      expect(
        isTransportFailure(Object.assign(new TypeError('fetch failed'), { cause: { code } }))
      ).toBe(true);
    }
  );

  it.each([
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'ERR_SSL_TLSV1_UNRECOGNIZED_NAME',
    'CERT_HAS_EXPIRED',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT'
  ])('treats a %s TLS failure as one', code => {
    expect(
      isTransportFailure(Object.assign(new TypeError('fetch failed'), { cause: { code } }))
    ).toBe(true);
  });

  it('does not treat a plain upstream 404 as one', () => {
    expect(isTransportFailure({ status: 404 })).toBe(false);
  });

  it('does not treat an invalid-argument rejection as one', () => {
    expect(isTransportFailure({ code: 'INVALID_ARGUMENT' })).toBe(false);
  });

  it('does not treat an unrelated error as one', () => {
    expect(isTransportFailure(new Error('boom'))).toBe(false);
  });
});
