import {
  isSilencedError,
  normalizeHandles,
  withoutEmptyAddress
} from '../../../src/addressResolvers/utils';

describe('utils', () => {
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
  });
});
