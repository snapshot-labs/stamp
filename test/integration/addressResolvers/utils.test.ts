import {
  isSilencedError,
  isStarknetAddress,
  normalizeAddresses,
  normalizeHandles,
  withoutEmptyAddress
} from '../../../src/addressResolvers/utils';

// A Starknet address is a felt, strictly below 2^251 - 256. See STAMP-6W.
const HIGHEST_VALID = '0x07fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeff';
const UPPER_BOUND = '0x07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
const PROPOSAL_ID = '0x4a4e4d7b8f47e2f9e0d5c3a1b6f8e2d4c7a9b1e3f5d7c9a2b4e6f8d1c3a5b7e9';

describe('utils', () => {
  describe('isStarknetAddress', () => {
    const ABOVE_UPPER_BOUND = '0x07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff01';

    it('accepts a felt below the upper bound, in either case', () => {
      expect(isStarknetAddress(HIGHEST_VALID)).toBe(true);
      expect(isStarknetAddress(HIGHEST_VALID.toUpperCase().replace('0X', '0x'))).toBe(true);
      expect(isStarknetAddress(`0x${'0'.repeat(64)}`)).toBe(true);
    });

    it('rejects the upper bound itself and anything above it', () => {
      expect(isStarknetAddress(UPPER_BOUND)).toBe(false);
      expect(isStarknetAddress(ABOVE_UPPER_BOUND)).toBe(false);
      expect(isStarknetAddress(PROPOSAL_ID)).toBe(false);
      expect(isStarknetAddress(`0x${'f'.repeat(64)}`)).toBe(false);
    });

    it('rejects values the felt check alone would accept', () => {
      expect(isStarknetAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
      expect(isStarknetAddress('0xef8305e140ac520225daf050e2f71d5fbcc543e7')).toBe(false);
      expect(isStarknetAddress('0x1')).toBe(false);
      expect(isStarknetAddress(HIGHEST_VALID.slice(2))).toBe(false);
      expect(isStarknetAddress(HIGHEST_VALID.slice(0, -1))).toBe(false);
    });

    it('rejects non-string input without throwing', () => {
      const offType = [undefined, null, 1, true, [], {}, ''] as unknown as string[];

      offType.forEach(value => expect(isStarknetAddress(value)).toBe(false));
    });
  });

  describe('normalizeAddresses', () => {
    it('keeps a starknet address below the upper bound, lowercased', () => {
      expect(
        normalizeAddresses(['0x07FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFF'])
      ).toEqual([HIGHEST_VALID]);
    });

    it('drops 64-char hex values at or above the upper bound', () => {
      expect(normalizeAddresses([UPPER_BOUND, PROPOSAL_ID])).toEqual([]);
    });

    it('keeps EVM addresses, checksummed', () => {
      expect(normalizeAddresses(['0xef8305e140ac520225daf050e2f71d5fbcc543e7'])).toEqual([
        '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7'
      ]);
    });
  });

  describe('normalizeHandles', () => {
    const VALID_DOMAINS = ['test.com', 'test.lens', 'test.ens'];
    const INVALID_DOMAINS = [1, '', false, 'hello world.com', 'hello'];

    it('should return only domain-like values', () => {
      // @ts-ignore
      expect(normalizeHandles([...INVALID_DOMAINS, ...VALID_DOMAINS])).toEqual([...VALID_DOMAINS]);
    });
  });

  describe('withoutEmptyAddress', () => {
    const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

    it('should remove entry with EMPTY_ADDRESS key', () => {
      const input = {
        [EMPTY_ADDRESS]: 'some value'
      };
      expect(withoutEmptyAddress(input)).toEqual({});
    });

    it('should keep normal entries', () => {
      const input = {
        '0x123': 'value1',
        '0x456': 'value2'
      };
      expect(withoutEmptyAddress(input)).toEqual(input);
    });

    it('should handle mixed entries', () => {
      const input = {
        [EMPTY_ADDRESS]: 'empty',
        '0x123': 'value1',
        '0x456': 'value2'
      };
      expect(withoutEmptyAddress(input)).toEqual({
        '0x123': 'value1',
        '0x456': 'value2'
      });
    });

    it('should handle empty object', () => {
      expect(withoutEmptyAddress({})).toEqual({});
    });
  });

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

    it('silences an axios 504 (status on error.response)', () => {
      // Shape observed from Sentry STAMP-7: axios throws with the HTTP status
      // on error.response.status, while error.code is 'ERR_BAD_RESPONSE'.
      // The previous `||` chain short-circuited on error.code and never
      // reached error.response.status.
      const axiosError = {
        message: 'Request failed with status code 504',
        code: 'ERR_BAD_RESPONSE',
        response: { status: 504 }
      };

      expect(isSilencedError(axiosError)).toBe(true);
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

    it('silences an axios 429', () => {
      const axiosError = {
        message: 'Request failed with status code 429',
        code: 'ERR_BAD_REQUEST',
        response: { status: 429 }
      };

      expect(isSilencedError(axiosError)).toBe(true);
    });

    it('does not silence a non-504 axios error', () => {
      const axiosError = {
        message: 'Request failed with status code 500',
        code: 'ERR_BAD_RESPONSE',
        response: { status: 500 }
      };

      expect(isSilencedError(axiosError)).toBe(false);
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
});
