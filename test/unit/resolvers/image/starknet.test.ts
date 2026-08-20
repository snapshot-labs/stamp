import starknet from '../../../../src/resolvers/image/starknet';

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({
    getStarkProfile: async () => ({ profilePicture: 'https://example.com/profile.png' })
  })
}));

const mockedFetch = jest.spyOn(global, 'fetch');

const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';

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

  it('aborts an incomplete metadata body at the total deadline', async () => {
    mockedFetch.mockImplementation(async (_url, init) =>
      incompleteJsonResponse((init as RequestInit | undefined)?.signal)
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      name: 'AbortError'
    });
  });
});
