const mockGetStarkProfile = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({ getStarkProfile: mockGetStarkProfile })
}));

import starknet from '../../../../src/resolvers/image/starknet';

const OVER_PRIME_ADDRESS = '0x2121212121212121212121212121212121212121212121212121212121212121';
const UNPREFIXED_ADDRESS = '07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const EVM_ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const UNPADDED_ADDRESS = '0xa00373a00352aa367058555149b573322910d54fcdf3a926e3e56d0dcb4b0c';

describe('Starknet image resolver', () => {
  it.each([OVER_PRIME_ADDRESS, UNPREFIXED_ADDRESS, EVM_ADDRESS])(
    'does not query a profile for %s, which is not a Starknet address',
    async address => {
      await expect(starknet(address)).resolves.toBe(false);
      expect(mockGetStarkProfile).not.toHaveBeenCalled();
    }
  );

  it('queries a profile for an address that is not zero-padded', async () => {
    mockGetStarkProfile.mockResolvedValue({ profilePicture: null });

    await expect(starknet(UNPADDED_ADDRESS)).resolves.toBe(false);
    expect(mockGetStarkProfile).toHaveBeenCalledWith(UNPADDED_ADDRESS);
  });
});
