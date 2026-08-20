const mockGetStarkProfile = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({ getStarkProfile: mockGetStarkProfile })
}));

import starknet from '../../../../src/resolvers/image/starknet';

const mockedFetch = jest.spyOn(global, 'fetch');

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

function incompleteJsonResponse(signal?: AbortSignal | null) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"image":'));
        signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

afterAll(() => {
  mockedFetch.mockRestore();
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
      incompleteJsonResponse((init as RequestInit | undefined)?.signal)
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      name: 'AbortError'
    });
  });
});
