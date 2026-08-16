import axios from 'axios';
import nodeFetch from 'node-fetch';
import farcaster from '../../../../src/resolvers/image/farcaster';
import { resolveSpaceAvatar, resolveSpaceLogo } from '../../../../src/resolvers/image/snapshot';
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
const NOT_AN_ADDRESS = '0x00006ba9855965EeEc09B5D43B113944c27F45aD3Ce';

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
    it('answers false for a space id that is not an address, without asking', async () => {
      await expect(resolveSpaceAvatar('ens.eth', 1, 'eth')).resolves.toBe(false);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('answers false for an onchain logo instead of asking for a field that is not there', async () => {
      await expect(resolveSpaceLogo(ADDRESS, 1, 'eth')).resolves.toBe(false);
      expect(mockedAxios).not.toHaveBeenCalled();
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
