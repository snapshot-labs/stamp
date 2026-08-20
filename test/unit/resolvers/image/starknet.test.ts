import starknet from '../../../../src/resolvers/image/starknet';

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({
    getStarkProfile: async () => ({ profilePicture: 'https://example.com/profile.png' })
  })
}));

const originalFetch = global.fetch;
const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof global.fetch;

const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';

afterAll(() => {
  global.fetch = originalFetch;
});

describe('starknet image resolver', () => {
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
});
