const mockGetStarkProfile = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({
    getStarkProfile: mockGetStarkProfile,
    getAddressFromStarkName: jest.fn()
  })
}));

import starknet from '../../../../src/resolvers/image/starknet';

const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';

beforeEach(() => {
  mockGetStarkProfile.mockReset().mockResolvedValue({
    profilePicture: 'https://example.com/avatar'
  });
});

describe('Starknet image resolver', () => {
  it('rejects and cancels a streaming body whose media type is neither image nor JSON', async () => {
    const cancel = jest.fn();
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Buffer.from('<html>not an image'));
          signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
        cancel
      });
      return new Response(body, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    });

    try {
      await expect(starknet(ADDRESS)).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('not an image: text/html; charset=utf-8')
      });
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
