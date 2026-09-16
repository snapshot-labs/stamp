const mockCallContract = jest.fn();

jest.mock('../../../../src/helpers/provider', () => ({
  getProvider: () => ({
    callContract: mockCallContract
  })
}));

import { byteArray, CallData, hash } from 'starknet';
import { isSilencedError } from '../../../../src/helpers/errors';
import { MAX_IMAGE_BYTES } from '../../../../src/helpers/http';
import starknet from '../../../../src/resolvers/image/starknet';
import { answeredFrom, incompleteJsonResponse, jsonResponse } from '../../../helpers/fetch';

const ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const OVER_PRIME_ADDRESS = '0x2121212121212121212121212121212121212121212121212121212121212121';
const UNPREFIXED_ADDRESS = '07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const EVM_ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const UNPADDED_ADDRESS = '0xa00373a00352aa367058555149b573322910d54fcdf3a926e3e56d0dcb4b0c';
const NFT_CONTRACT = '0x123';
const AVATAR_URL = 'https://example.com/avatar';
const NFT_IMAGE_URL = 'https://example.com/nft.png';
const IMAGE_URL = 'https://example.com/avatar/token-12345.png';
const IMAGE = Buffer.from('as much of an image as the fetch cares about');
const UNSUPPORTED_ENTRYPOINT = 'starknetid/multicall-failed: ENTRYPOINT_NOT_FOUND';

let fetchSpy: jest.SpyInstance;

// The starknet.id multicall replies [count, length, ...result, length, ...result, ...],
// with no token URI result when the profile has no NFT contract.
function profileReply(tokenUri?: string[], id = '0x42', nftContract = NFT_CONTRACT) {
  const results = [['0x1', '0xabc'], [id], [nftContract], ['0x2', '0x4e20', '0x0']];
  if (tokenUri) results.push(tokenUri);

  return [
    `0x${results.length.toString(16)}`,
    ...results.flatMap(result => [`0x${result.length.toString(16)}`, ...result])
  ];
}

function mockNftPicture(uri: string) {
  mockCallContract.mockResolvedValue(
    profileReply(CallData.compile(byteArray.byteArrayFromString(uri)))
  );
}

const selector = (name: string) => BigInt(hash.getSelectorFromName(name)).toString();

const tokenUriEntrypoints = () =>
  mockCallContract.mock.calls.map(([{ calldata }]) =>
    ['tokenURI', 'token_uri'].find(name => calldata.includes(selector(name)))
  );

beforeEach(() => {
  mockCallContract.mockReset();
  mockNftPicture(AVATAR_URL);
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
      expect(mockCallContract).not.toHaveBeenCalled();
    }
  );

  it('queries a profile for an address that is not zero-padded', async () => {
    mockCallContract.mockResolvedValue(profileReply(undefined, '0x0', '0x0'));

    await expect(starknet(UNPADDED_ADDRESS)).resolves.toBe(false);
    expect(mockCallContract.mock.calls[0][0].calldata).toContain(
      BigInt(UNPADDED_ADDRESS).toString()
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('answers false for a profile picture that cannot become a fetchable URL', async () => {
    mockNftPicture('http://');

    await expect(starknet(ADDRESS)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('misses on on-chain metadata whose image cannot become a fetchable URL', async () => {
    mockNftPicture('https://example.com/metadata.json');
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ image: 'http://' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({ status: 404 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-2xx image response with its HTTP status', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        answeredFrom(AVATAR_URL, new Response('missing', { status: 404, statusText: 'Not Found' }))
      );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({
      message: '[example.com] Not Found',
      status: 404,
      response: { status: 404 }
    });
  });

  it('rejects a profile picture over the size cap', async () => {
    fetchSpy.mockResolvedValue(
      answeredFrom(
        AVATAR_URL,
        new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), {
          headers: { 'Content-Type': 'image/png' }
        })
      )
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
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(answeredFrom(IMAGE_URL, new Response(Buffer.from('image'))));
    const urlFelts = [IMAGE_URL.slice(0, 31), IMAGE_URL.slice(31)].map(
      part => `0x${Buffer.from(part).toString('hex')}`
    );
    mockCallContract
      .mockRejectedValueOnce(new Error(UNSUPPORTED_ENTRYPOINT))
      .mockResolvedValueOnce(profileReply(['0x2', ...urlFelts]));

    await expect(starknet(UNPADDED_ADDRESS)).resolves.toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledWith(IMAGE_URL, expect.anything());
    expect(tokenUriEntrypoints()).toEqual(['tokenURI', 'token_uri']);
  });

  it('decodes a Cairo 1 ByteArray token_uri', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(answeredFrom(IMAGE_URL, new Response(Buffer.from('image'))));
    const fullWord = IMAGE_URL.slice(0, 31);
    const pendingWord = IMAGE_URL.slice(31);
    mockCallContract
      .mockRejectedValueOnce(new Error(UNSUPPORTED_ENTRYPOINT))
      .mockResolvedValueOnce(
        profileReply([
          '0x1',
          `0x${Buffer.from(fullWord).toString('hex')}`,
          `0x${Buffer.from(pendingWord).toString('hex')}`,
          `0x${pendingWord.length.toString(16)}`
        ])
      );

    await expect(starknet(UNPADDED_ADDRESS)).resolves.toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledWith(IMAGE_URL, expect.anything());
  });

  it('renders an NFT picture whose tokenURI replies with a Cairo 1 ByteArray', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify({ image })).toString('base64')}`;
    mockNftPicture(uri);
    fetchSpy.mockRestore();

    await expect(starknet(ADDRESS)).resolves.toEqual(Buffer.from(svg));
    // One request, and through tokenURI: the Cairo 0 contracts only have tokenURI.
    expect(tokenUriEntrypoints()).toEqual(['tokenURI']);
  });

  it('fetches the identicon of a profile without an NFT picture', async () => {
    const identicon = 'https://starknet.id/api/identicons/847214245145';
    mockCallContract.mockResolvedValue(profileReply(undefined, '0xc541e77519', '0x0'));
    fetchSpy.mockResolvedValue(
      answeredFrom(identicon, new Response(IMAGE, { headers: { 'Content-Type': 'image/svg+xml' } }))
    );

    await expect(starknet(ADDRESS)).resolves.toEqual(IMAGE);
    expect(fetchSpy).toHaveBeenCalledWith(identicon, expect.anything());
    expect(mockCallContract).toHaveBeenCalledTimes(1);
  });

  it('links a fallback failure to the original profile error', async () => {
    const profileError = new Error(UNSUPPORTED_ENTRYPOINT);
    const fallbackError = new Error('fallback RPC failed');
    mockCallContract.mockRejectedValueOnce(profileError).mockRejectedValueOnce(fallbackError);

    await expect(starknet(UNPADDED_ADDRESS)).rejects.toBe(fallbackError);
    expect(fallbackError.cause).toBe(profileError);
  });

  it('does not hide unrelated profile errors', async () => {
    const error = new Error('RPC timeout');
    mockCallContract.mockRejectedValue(error);

    await expect(starknet(UNPADDED_ADDRESS)).rejects.toBe(error);
    expect(mockCallContract).toHaveBeenCalledTimes(1);
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
      return answeredFrom(
        AVATAR_URL,
        new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      );
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
      .mockResolvedValue(
        answeredFrom(AVATAR_URL, new Response(IMAGE, { headers: { 'Content-Type': 'image/png' } }))
      );

    await expect(starknet(ADDRESS)).resolves.toEqual(IMAGE);
  });

  it('follows a JSON metadata response to its image', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async input =>
      String(input).endsWith('/avatar')
        ? new Response(JSON.stringify({ image: 'https://example.com/nft.png' }), {
            headers: { 'Content-Type': 'application/json' }
          })
        : answeredFrom(
            NFT_IMAGE_URL,
            new Response(IMAGE, { headers: { 'Content-Type': 'image/png' } })
          )
    );

    await expect(starknet(ADDRESS)).resolves.toEqual(IMAGE);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a +json structured suffix', 'application/ld+json'],
    ['text/json', 'text/json']
  ])('follows a JSON metadata response served as %s', async (_name, contentType) => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async input =>
      String(input).endsWith('/avatar')
        ? new Response(JSON.stringify({ image: 'https://example.com/nft.png' }), {
            headers: { 'Content-Type': contentType }
          })
        : answeredFrom(
            NFT_IMAGE_URL,
            new Response(IMAGE, { headers: { 'Content-Type': 'image/png' } })
          )
    );

    await expect(starknet(ADDRESS)).resolves.toEqual(IMAGE);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('raises a routine miss on a non-2xx JSON response instead of reading it as metadata', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      answeredFrom(
        AVATAR_URL,
        new Response(JSON.stringify({ image: NFT_IMAGE_URL }), {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    await expect(starknet(ADDRESS)).rejects.toMatchObject({ status: 404 });
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

    await expect(starknet(ADDRESS)).rejects.toMatchObject({ status: 404 });
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
    mockNftPicture(metadataUri);
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ image: imageUri }))
      .mockResolvedValueOnce(
        answeredFrom(
          imageUri,
          new Response('svg-bytes', { headers: { 'Content-Type': 'image/svg+xml' } })
        )
      );

    await expect(starknet(ADDRESS)).resolves.toBeInstanceOf(Buffer);

    expect(fetchSpy).toHaveBeenNthCalledWith(1, metadataUri, expect.anything());
    expect(fetchSpy).toHaveBeenNthCalledWith(2, imageUri, expect.anything());
  });
});
