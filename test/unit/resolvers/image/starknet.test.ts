const mockGetStarkProfile = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({ getStarkProfile: mockGetStarkProfile })
}));

import starknet from '../../../../src/resolvers/image/starknet';

const OVER_PRIME_ADDRESS = '0x2121212121212121212121212121212121212121212121212121212121212121';
const UNPREFIXED_ADDRESS = '07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';

describe('Starknet image resolver', () => {
  it.each([OVER_PRIME_ADDRESS, UNPREFIXED_ADDRESS])(
    'does not query a profile for invalid address %s',
    async address => {
      await expect(starknet(address)).resolves.toBe(false);
      expect(mockGetStarkProfile).not.toHaveBeenCalled();
    }
  );
});
