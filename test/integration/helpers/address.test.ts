import {
  isStarknetAddress,
  normalizeAddresses,
  normalizeHandles,
  withoutEmptyAddress
} from '../../../src/helpers/address';

// A Starknet address is a felt, strictly below 2^251 - 256. See STAMP-6W.
const HIGHEST_VALID = '0x07fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeff';
const UPPER_BOUND = '0x07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
const PROPOSAL_ID = '0x4a4e4d7b8f47e2f9e0d5c3a1b6f8e2d4c7a9b1e3f5d7c9a2b4e6f8d1c3a5b7e9';

describe('address helpers', () => {
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
});
