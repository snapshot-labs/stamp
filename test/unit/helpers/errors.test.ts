import { isRoutineMiss, isSilencedError } from '../../../src/helpers/errors';

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

describe('isRoutineMiss', () => {
  it.each(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'])('treats a %s errno as routine', code => {
    expect(isRoutineMiss(Object.assign(new TypeError('fetch failed'), { cause: { code } }))).toBe(
      true
    );
  });

  it.each([
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'CERT_HAS_EXPIRED',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT'
  ])('treats a %s TLS failure as routine', code => {
    expect(isRoutineMiss(Object.assign(new TypeError('fetch failed'), { cause: { code } }))).toBe(
      true
    );
  });

  it('treats a plain upstream 404 as routine', () => {
    expect(isRoutineMiss({ status: 404 })).toBe(true);
  });

  it.each([401, 402, 403])('keeps an upstream %i out of the routine band', status => {
    expect(isRoutineMiss({ status })).toBe(false);
  });

  it('does not treat an upstream 500 as routine', () => {
    expect(isRoutineMiss({ status: 500 })).toBe(false);
  });

  it('treats an invalid-argument rejection as routine', () => {
    expect(isRoutineMiss({ code: 'INVALID_ARGUMENT' })).toBe(true);
  });

  it('does not treat an unrelated error as routine', () => {
    expect(isRoutineMiss(new Error('boom'))).toBe(false);
  });
});
