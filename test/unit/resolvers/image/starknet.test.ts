const mockGetStarkProfile = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({
    getStarkProfile: mockGetStarkProfile,
    getAddressFromStarkName: jest.fn()
  })
}));
jest.mock('axios', () => ({ __esModule: true, default: jest.fn() }));

import axios from 'axios';
import starknet from '../../../../src/resolvers/image/starknet';

const mockedAxios = axios as unknown as jest.Mock;
const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';

beforeEach(() => {
  mockGetStarkProfile.mockReset().mockResolvedValue({
    profilePicture: 'https://example.com/avatar'
  });
  mockedAxios.mockReset();
});

describe('Starknet image resolver', () => {
  it('rejects a successful response whose body is neither image nor JSON', async () => {
    mockedAxios.mockResolvedValue({
      headers: { 'content-type': 'text/html; charset=utf-8' },
      data: Buffer.from('<html>not an image</html>')
    });

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('not an image: text/html; charset=utf-8')
    });
  });
});
