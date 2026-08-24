const mockGetStarkProfile = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({ getStarkProfile: mockGetStarkProfile })
}));

import starknet from '../../../../src/resolvers/image/starknet';
import { incompleteJsonResponse, jsonResponse, mockGlobalFetch } from '../../../helpers/fetch';

const mockedFetch = mockGlobalFetch();

const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const OVER_PRIME_ADDRESS = '0x2121212121212121212121212121212121212121212121212121212121212121';
const UNPREFIXED_ADDRESS = '07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const EVM_ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const UNPADDED_ADDRESS = '0xa00373a00352aa367058555149b573322910d54fcdf3a926e3e56d0dcb4b0c';

beforeEach(() => {
  mockGetStarkProfile.mockReset().mockResolvedValue({
    profilePicture: 'https://example.com/profile.png'
  });
});

describe('Starknet image resolver', () => {
  it.each([OVER_PRIME_ADDRESS, UNPREFIXED_ADDRESS, EVM_ADDRESS])(
    'does not query a profile for %s',
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

  it('rejects a non-2xx image response with its HTTP status', async () => {
    mockedFetch.mockResolvedValue(
      new Response('missing', { status: 404, statusText: 'Not Found' })
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      message: '[example.com] Not Found',
      status: 404,
      response: { status: 404 }
    });
  });

  it('aborts an incomplete metadata body at the total deadline', async () => {
    mockedFetch.mockImplementation(async (_url, init) =>
      incompleteJsonResponse('{"image":', (init as RequestInit | undefined)?.signal)
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      name: 'AbortError'
    });
  });

  it('fetches a data: URI profile picture directly rather than through the IPFS gateway', async () => {
    const metadataUri =
      'data:application/json;base64,eyJpbWFnZSI6ImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5In0=';
    const imageUri = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i';
    mockGetStarkProfile.mockResolvedValue({ profilePicture: metadataUri });
    mockedFetch
      .mockResolvedValueOnce(jsonResponse({ image: imageUri }))
      .mockResolvedValueOnce(new Response('svg-bytes'));

    await expect(starknet(ADDRESS)).resolves.toBeInstanceOf(Buffer);

    expect(mockedFetch).toHaveBeenNthCalledWith(1, metadataUri, expect.anything());
    expect(mockedFetch).toHaveBeenNthCalledWith(2, imageUri, expect.anything());
  });
});
