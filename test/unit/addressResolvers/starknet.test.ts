const mockGetStarkName = jest.fn();
const mockGetAddressFromStarkName = jest.fn();

jest.mock('../../../src/addressResolvers/utils', () => {
  const actual = jest.requireActual('../../../src/addressResolvers/utils');

  return {
    ...actual,
    provider: () => ({
      getStarkName: mockGetStarkName,
      getAddressFromStarkName: mockGetAddressFromStarkName
    })
  };
});

import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/starknet';

const PADDED = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const UNPADDED = '0x7ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const MIXED_CASE = '0x7FF6b17F07c4d83236e3FC5f94259a19D1ed41BBcf1822397ea17882e9B038D';
const ZERO_ADDRESS = `0x${'0'.repeat(64)}`;
const EVM_ADDRESS = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

describe('Starknet address resolver', () => {
  describe('resolveNames()', () => {
    describe('address padding', () => {
      it('pads the unpadded address returned by the contract to 64 hex digits', async () => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(UNPADDED);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({
          'checkpoint.stark': PADDED
        });
      });

      it('returns an already padded address unchanged', async () => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(PADDED);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({
          'checkpoint.stark': PADDED
        });
      });

      it('lowercases a mixed-case address', async () => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(MIXED_CASE);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({
          'checkpoint.stark': PADDED
        });
      });

      it('pads an EVM-shaped 40 hex digits address', async () => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(EVM_ADDRESS);

        await expect(resolveNames(['evm.stark'])).resolves.toEqual({
          'evm.stark': `0x${'0'.repeat(24)}d8da6bf26964af9d7eed9e03e53415d37aa96045`
        });
      });
    });

    describe('when the name has no address', () => {
      it.each(['0x0', '', undefined, null])('drops %p', async value => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(value);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({});
      });

      it('drops the zero address', async () => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(ZERO_ADDRESS);

        await expect(resolveNames(['checkpoint.stark'])).resolves.toEqual({});
      });
    });

    describe('when the contract returns a value that is not an address', () => {
      it.each([
        ['non hex characters', '0xzz'],
        ['more than 64 hex digits', `0x1${'f'.repeat(64)}`],
        ['a felt above the address bound', `0x${'f'.repeat(64)}`]
      ])('rejects on %s, leaving the report to addressResolvers/index', async (_, value) => {
        mockGetAddressFromStarkName.mockResolvedValueOnce(value);

        await expect(resolveNames(['checkpoint.stark'])).rejects.toThrow();
      });
    });

    it('ignores non-stark handles', async () => {
      await expect(resolveNames(['domain.eth', 'domain.crypto'])).resolves.toEqual({});
      expect(mockGetAddressFromStarkName).not.toHaveBeenCalled();
    });
  });

  describe('lookupAddresses()', () => {
    it('drops addresses without a name, and keeps the others', async () => {
      mockGetStarkName.mockResolvedValueOnce('checkpoint.stark');
      mockGetStarkName.mockRejectedValueOnce(new Error('Starkname not found'));

      await expect(lookupAddresses([PADDED, ZERO_ADDRESS])).resolves.toEqual({
        [PADDED]: 'checkpoint.stark'
      });
    });

    it('rejects with any other error, leaving the report to addressResolvers/index', async () => {
      const error = new Error('Could not get stark name');
      mockGetStarkName.mockRejectedValueOnce(error);

      await expect(lookupAddresses([PADDED])).rejects.toBe(error);
    });

    it('ignores non-starknet addresses', async () => {
      await expect(lookupAddresses([EVM_ADDRESS])).resolves.toEqual({});
      expect(mockGetStarkName).not.toHaveBeenCalled();
    });
  });
});
