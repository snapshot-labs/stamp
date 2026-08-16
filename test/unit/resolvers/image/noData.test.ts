import axios from 'axios';
import nodeFetch from 'node-fetch';
import farcaster from '../../../../src/resolvers/image/farcaster';
import {
  resolveSpaceAvatar,
  resolveSpaceLogo,
  resolveUserAvatar
} from '../../../../src/resolvers/image/snapshot';
import { resolveAvatar as resolveSxAvatar } from '../../../../src/resolvers/image/space-sx';
import starknet from '../../../../src/resolvers/image/starknet';

jest.mock('axios', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }));

jest.mock('../../../../src/helpers/http', () => ({
  ...jest.requireActual('../../../../src/helpers/http'),
  fetchHttpImage: jest.fn()
}));

const mockedAxios = axios as unknown as jest.Mock;
const mockedFetch = nodeFetch as unknown as jest.Mock;

// coingecko reads its key at module load and answers false without one, so the
// module has to be loaded with the key already set to reach the response at all.
function loadCoingecko() {
  process.env.COINGECKO_API_KEY = 'test-key';

  let resolve: (address: string, chainId: string) => Promise<Buffer | false>;
  jest.isolateModules(() => {
    resolve = jest.requireActual('../../../../src/resolvers/image/coingecko').default;
  });

  return resolve!;
}

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const STARKNET_ADDRESS = '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d';
const UNPADDED_STARKNET_ADDRESS = `0x${STARKNET_ADDRESS.slice(3)}`;
const NOT_AN_ADDRESS = '0x00006ba9855965EeEc09B5D43B113944c27F45aD3Ce';
const STARKNET_ADDRESS = '0x0546a9a0d1a5b6cbb3a1c1c9d0e5d5a3c8a2f5c9d5b6cbb3a1c1c9d0e5d5a3c8';

const entry = (found: any) => ({ status: 200, data: { data: { entry: found } } });
const spaces = (found: any[]) => ({ status: 200, data: { data: { spaces: found } } });

describe('resolvers answer false rather than throwing when there is no data', () => {
  describe('starknet', () => {
    it('answers false for an EVM address, which is what every avatar request carries', async () => {
      await expect(starknet(ADDRESS)).resolves.toBe(false);
    });
  });

  describe('space-sx', () => {
    it('answers false for an id that is not an address, without asking', async () => {
      await expect(resolveSxAvatar(NOT_AN_ADDRESS)).resolves.toBe(false);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('answers false when neither API has the space', async () => {
      mockedAxios.mockResolvedValue(spaces([]));

      await expect(resolveSxAvatar(ADDRESS)).resolves.toBe(false);
    });

    it('answers false when one API is down and the other has no space', async () => {
      mockedAxios
        .mockRejectedValueOnce(new Error('mainnet is down'))
        .mockResolvedValueOnce(spaces([]));

      await expect(resolveSxAvatar(ADDRESS)).resolves.toBe(false);
    });

    it('rejects when every API is down', async () => {
      mockedAxios.mockRejectedValue(new Error('everything is down'));

      await expect(resolveSxAvatar(ADDRESS)).rejects.toThrow('everything is down');
    });
  });

  describe('snapshot', () => {
    it.each(['vitalik.eth', 'foo.lens', 'foo.stark', '1'])(
      'answers false for invalid user id %s without asking',
      async id => {
        await expect(resolveUserAvatar(id)).resolves.toBe(false);
        expect(mockedAxios).not.toHaveBeenCalled();
      }
    );

    it.each([
      ['EVM', ` ${ADDRESS.toLowerCase()} `, ADDRESS],
      ['Starknet', ` ${STARKNET_ADDRESS} `, STARKNET_ADDRESS],
      ['unpadded Starknet', ` ${UNPADDED_STARKNET_ADDRESS} `, UNPADDED_STARKNET_ADDRESS]
    ])('normalizes a valid %s user id', async (_type, id, expected) => {
      mockedAxios.mockResolvedValue(entry({ avatar: null }));

      await expect(resolveUserAvatar(id)).resolves.toBe(false);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ variables: { id: expected } }) })
      );
    });

    it.each([
      ['slug', 'ens.eth', 'ens.eth'],
      ['EVM address', ADDRESS.toLowerCase(), ADDRESS]
    ])('preserves an offchain space %s', async (_type, id, expected) => {
      mockedAxios.mockResolvedValue(entry({ avatar: null }));

      await expect(resolveSpaceAvatar(id, 1, 's')).resolves.toBe(false);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ variables: { id: expected } }) })
      );
    });

    it('answers false for a space id that is not an address, without asking', async () => {
      await expect(resolveSpaceAvatar('ens.eth', 1, 'eth')).resolves.toBe(false);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('answers false for an onchain logo instead of asking for a field that is not there', async () => {
      await expect(resolveSpaceLogo(ADDRESS, 1, 'eth')).resolves.toBe(false);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('answers false for a user id that is not an address, without asking', async () => {
      await expect(resolveUserAvatar('vitalik.eth')).resolves.toBe(false);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('still asks for a starknet user id', async () => {
      mockedAxios.mockResolvedValue({ status: 200, data: { data: { entry: null } } });

      await expect(resolveUserAvatar(STARKNET_ADDRESS)).resolves.toBe(false);
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });
  });

  describe('coingecko', () => {
    const apiKey = process.env.COINGECKO_API_KEY;
    const globalFetch = global.fetch;

    afterEach(() => {
      process.env.COINGECKO_API_KEY = apiKey;
      global.fetch = globalFetch;
    });

    const respondWith = (response: any) => {
      global.fetch = jest.fn().mockResolvedValue(response) as any;
    };

    it('answers false for a token the API does not have', async () => {
      respondWith({ ok: false, status: 404 });

      await expect(loadCoingecko()(ADDRESS, '1')).resolves.toBe(false);
    });

    it('answers false for a token the API has no image for', async () => {
      respondWith({ ok: true, status: 200, json: async () => ({ image: {} }) });

      await expect(loadCoingecko()(ADDRESS, '1')).resolves.toBe(false);
    });

    it('rejects on any other non-2xx, carrying the status', async () => {
      respondWith({ ok: false, status: 401, statusText: 'Unauthorized' });

      await expect(loadCoingecko()(ADDRESS, '1')).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('farcaster', () => {
    it('answers false for an address with no account', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(farcaster(ADDRESS)).resolves.toBe(false);
    });

    it('answers false when the response carries no account for the address', async () => {
      mockedFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      await expect(farcaster(ADDRESS)).resolves.toBe(false);
    });

    it('rejects on any other non-2xx, carrying the status', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 402, statusText: 'Payment Required' });

      await expect(farcaster(ADDRESS)).rejects.toMatchObject({ status: 402 });
    });
  });
});
