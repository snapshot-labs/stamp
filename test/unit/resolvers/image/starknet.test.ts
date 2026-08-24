const mockGetStarkProfile = jest.fn();
const mockCallContract = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({
    getStarkProfile: mockGetStarkProfile,
    callContract: mockCallContract,
    getAddressFromStarkName: jest.fn()
  })
}));

import { isSilencedError } from '../../../../src/helpers/errors';
import { MAX_IMAGE_BYTES } from '../../../../src/helpers/http';
import starknet from '../../../../src/resolvers/image/starknet';
import { incompleteJsonResponse, jsonResponse } from '../../../helpers/fetch';

const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const OVER_PRIME_ADDRESS = '0x2121212121212121212121212121212121212121212121212121212121212121';
const UNPREFIXED_ADDRESS = '07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const EVM_ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const UNPADDED_ADDRESS = '0xa00373a00352aa367058555149b573322910d54fcdf3a926e3e56d0dcb4b0c';
const NFT_CONTRACT = '0x123';
const IMAGE_URL = 'https://example.com/avatar/token-12345.png';
const IMAGE = Buffer.from('as much of an image as the fetch cares about');

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  mockCallContract.mockReset();
  mockGetStarkProfile.mockReset().mockResolvedValue({
    profilePicture: 'https://example.com/avatar'
  });
  fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
});

afterEach(() => {
  fetchSpy.mockRestore();
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

  it('answers false for a profile picture that cannot become a fetchable URL', async () => {
    mockGetStarkProfile.mockResolvedValue({ profilePicture: 'http://' });

    await expect(starknet(ADDRESS)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('answers false for on-chain metadata whose image cannot become a fetchable URL', async () => {
    mockGetStarkProfile.mockResolvedValue({ profilePicture: 'https://example.com/metadata.json' });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ image: 'http://' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(starknet(ADDRESS)).resolves.toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-2xx image response with its HTTP status', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('missing', { status: 404, statusText: 'Not Found' }));

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      message: '[example.com] Not Found',
      status: 404,
      response: { status: 404 }
    });
  });

  it('rejects a profile picture over the size cap', async () => {
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), {
        headers: { 'Content-Type': 'image/png' }
      })
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('image too large')
    });
  });

  it('aborts an incomplete metadata body at the total deadline', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_input, init) =>
        incompleteJsonResponse('{"image":', (init as RequestInit | undefined)?.signal)
      );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      name: 'AbortError'
    });
  });

  it('falls back to token_uri when the profile multicall uses an unsupported entrypoint', async () => {
    mockGetStarkProfile.mockRejectedValue(
      new Error('starknetid/multicall-failed: ENTRYPOINT_NOT_FOUND')
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(Buffer.from('image')));
    const urlFelts = [IMAGE_URL.slice(0, 31), IMAGE_URL.slice(31)].map(
      part => `0x${Buffer.from(part).toString('hex')}`
    );
    mockCallContract
      .mockResolvedValueOnce(['0x1', '0xabc'])
      .mockResolvedValueOnce(['0x42'])
      .mockResolvedValueOnce([NFT_CONTRACT])
      .mockResolvedValueOnce(['0x2', '0x4e20', '0x0'])
      .mockResolvedValueOnce(['0x2', ...urlFelts]);

    await expect(starknet(UNPADDED_ADDRESS)).resolves.toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledWith(IMAGE_URL, expect.anything());
    expect(mockCallContract.mock.calls[1][0]).toEqual({
      contractAddress: expect.any(String),
      entrypoint: 'domain_to_id',
      calldata: ['0x1', '0xabc']
    });
    expect(mockCallContract).toHaveBeenLastCalledWith({
      contractAddress: NFT_CONTRACT,
      entrypoint: 'token_uri',
      calldata: ['0x4e20', '0x0']
    });
  });

  it('decodes a Cairo 1 ByteArray token_uri', async () => {
    mockGetStarkProfile.mockRejectedValue(
      new Error('starknetid/multicall-failed: ENTRYPOINT_NOT_FOUND')
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(Buffer.from('image')));
    const fullWord = IMAGE_URL.slice(0, 31);
    const pendingWord = IMAGE_URL.slice(31);
    mockCallContract
      .mockResolvedValueOnce(['0x1', '0xabc'])
      .mockResolvedValueOnce(['0x42'])
      .mockResolvedValueOnce([NFT_CONTRACT])
      .mockResolvedValueOnce(['0x2', '0x4e20', '0x0'])
      .mockResolvedValueOnce([
        '0x1',
        `0x${Buffer.from(fullWord).toString('hex')}`,
        `0x${Buffer.from(pendingWord).toString('hex')}`,
        `0x${pendingWord.length.toString(16)}`
      ]);

    await expect(starknet(UNPADDED_ADDRESS)).resolves.toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledWith(IMAGE_URL, expect.anything());
  });

  it('links a fallback failure to the original profile error', async () => {
    const profileError = new Error('starknetid/multicall-failed: ENTRYPOINT_NOT_FOUND');
    const fallbackError = new Error('fallback RPC failed');
    mockGetStarkProfile.mockRejectedValue(profileError);
    mockCallContract.mockRejectedValue(fallbackError);

    await expect(starknet(UNPADDED_ADDRESS)).rejects.toBe(fallbackError);
    expect(fallbackError.cause).toBe(profileError);
  });

  it('does not hide unrelated profile errors', async () => {
    const error = new Error('RPC timeout');
    mockGetStarkProfile.mockRejectedValue(error);

    await expect(starknet(UNPADDED_ADDRESS)).rejects.toBe(error);
    expect(mockCallContract).not.toHaveBeenCalled();
  });

  it('rejects and cancels a streaming body whose media type is neither image nor JSON', async () => {
    const cancel = jest.fn();
    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
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

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('not an image: text/html; charset=utf-8')
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('returns the bytes of an image response', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(IMAGE, { headers: { 'Content-Type': 'image/png' } }));

    await expect(starknet(ADDRESS)).resolves.toEqual(IMAGE);
  });

  it('follows a JSON metadata response to its image', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async input =>
      String(input).endsWith('/avatar')
        ? new Response(JSON.stringify({ image: 'https://example.com/nft.png' }), {
            headers: { 'Content-Type': 'application/json' }
          })
        : new Response(IMAGE, { headers: { 'Content-Type': 'image/png' } })
    );

    await expect(starknet(ADDRESS)).resolves.toEqual(IMAGE);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('raises the status of a non-2xx JSON response instead of reading it as metadata', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ image: 'https://example.com/nft.png' }), {
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({ status: 504 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['null', 'null'],
    ['an image that is not a string', '{"image":42}'],
    ['a body that is not JSON', 'not json at all'],
    ['no image field', '{"name":"nft"}']
  ])('reads a JSON metadata response carrying %s as no data', async (_name, body) => {
    fetchSpy.mockResolvedValue(
      new Response(body, { headers: { 'Content-Type': 'application/json' } })
    );

    await expect(starknet(ADDRESS)).resolves.toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('raises the deadline abort on a metadata body that never ends', async () => {
    fetchSpy.mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Buffer.from('{"'));
          signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        }
      });
      return new Response(body, { headers: { 'Content-Type': 'application/json' } });
    });

    const error = await starknet(ADDRESS).catch(err => err);

    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });

  it('fetches a data: URI profile picture directly rather than through the IPFS gateway', async () => {
    const metadataUri =
      'data:application/json;base64,eyJpbWFnZSI6ImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5In0=';
    const imageUri = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i';
    mockGetStarkProfile.mockResolvedValue({ profilePicture: metadataUri });
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ image: imageUri }))
      .mockResolvedValueOnce(
        new Response('svg-bytes', { headers: { 'Content-Type': 'image/svg+xml' } })
      );

    await expect(starknet(ADDRESS)).resolves.toBeInstanceOf(Buffer);

    expect(fetchSpy).toHaveBeenNthCalledWith(1, metadataUri, expect.anything());
    expect(fetchSpy).toHaveBeenNthCalledWith(2, imageUri, expect.anything());
  });
});
