import { isSilencedError } from '../../../src/helpers/errors';

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
