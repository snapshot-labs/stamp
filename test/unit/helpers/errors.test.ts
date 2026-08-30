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

  it('does not silence unrelated errors', () => {
    expect(isSilencedError(new Error('boom'))).toBe(false);
  });
});

describe('isTransportFailure', () => {
  it.each(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'])('treats a %s errno as one', code => {
    expect(
      isTransportFailure(Object.assign(new TypeError('fetch failed'), { cause: { code } }))
    ).toBe(true);
  });

  it.each([
    'ERR_TLS_CERT_ALTNAME_INVALID',
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
