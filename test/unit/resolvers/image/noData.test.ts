import farcaster from '../../../../src/resolvers/image/farcaster';
import lens from '../../../../src/resolvers/image/lens';
import {
  resolveSpaceAvatar,
  resolveSpaceLogo,
  resolveUserAvatar
} from '../../../../src/resolvers/image/snapshot';
import { resolveAvatar as resolveSxAvatar } from '../../../../src/resolvers/image/space-sx';
import starknet from '../../../../src/resolvers/image/starknet';
import { jsonResponse, mockGlobalFetch } from '../../../helpers/fetch';

jest.mock('../../../../src/helpers/http', () => ({
  ...jest.requireActual('../../../../src/helpers/http'),
  fetchHttpImage: jest.fn()
}));

const mockedFetch = mockGlobalFetch();

beforeEach(() => {
  mockedFetch.mockReset();
});

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

const graphQlResponse = (data: Record<string, any>) => jsonResponse({ data });

const entry = (found: any) => graphQlResponse({ entry: found });
const spaces = (found: any[]) => graphQlResponse({ spaces: found });

const sentVariables = () => JSON.parse(mockedFetch.mock.calls[0][1].body).variables;

describe('resolvers answer false rather than throwing when there is no data', () => {
  describe('starknet', () => {
    it('answers false for an EVM address, which is what every avatar request carries', async () => {
      await expect(starknet(ADDRESS)).resolves.toBe(false);
    });
  });

  describe('space-sx', () => {
    it('answers false for an id that is not an address, without asking', async () => {
      await expect(resolveSxAvatar(NOT_AN_ADDRESS)).resolves.toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('answers false when neither API has the space', async () => {
      mockedFetch.mockImplementation(async () => spaces([]));

      await expect(resolveSxAvatar(ADDRESS)).resolves.toBe(false);
      expect(mockedFetch).toHaveBeenCalledTimes(2);
    });

    it('answers false when one API is down and the other has no space', async () => {
      mockedFetch
        .mockRejectedValueOnce(new Error('mainnet is down'))
        .mockResolvedValueOnce(spaces([]));

      await expect(resolveSxAvatar(ADDRESS)).resolves.toBe(false);
    });

    it('rejects when every API is down', async () => {
      mockedFetch.mockRejectedValue(new Error('everything is down'));

      await expect(resolveSxAvatar(ADDRESS)).rejects.toThrow('everything is down');
    });

    it('answers false for an avatar reference that cannot become a fetchable URL', async () => {
      mockedFetch.mockResolvedValue(spaces([{ metadata: { avatar: 'http://' } }]));

      await expect(resolveSxAvatar(ADDRESS)).resolves.toBe(false);
    });
  });

  describe('snapshot', () => {
    it.each(['vitalik.eth', 'foo.lens', 'foo.stark', '1'])(
      'answers false for invalid user id %s without asking',
      async id => {
        await expect(resolveUserAvatar(id)).resolves.toBe(false);
        expect(mockedFetch).not.toHaveBeenCalled();
      }
    );

    it.each([
      ['EVM', ` ${ADDRESS.toLowerCase()} `, ADDRESS],
      ['Starknet', ` ${STARKNET_ADDRESS} `, STARKNET_ADDRESS],
      ['unpadded Starknet', ` ${UNPADDED_STARKNET_ADDRESS} `, UNPADDED_STARKNET_ADDRESS]
    ])('normalizes a valid %s user id', async (_type, id, expected) => {
      mockedFetch.mockResolvedValue(entry({ avatar: null }));

      await expect(resolveUserAvatar(id)).resolves.toBe(false);
      expect(sentVariables()).toEqual({ id: expected });
    });

    it.each([
      ['slug', 'ens.eth', 'ens.eth'],
      ['EVM address', ADDRESS.toLowerCase(), ADDRESS]
    ])('preserves an offchain space %s', async (_type, id, expected) => {
      mockedFetch.mockResolvedValue(entry({ avatar: null }));

      await expect(resolveSpaceAvatar(id, 1, 's')).resolves.toBe(false);
      expect(sentVariables()).toEqual({ id: expected });
    });

    it('answers false for a space id that is not an address, without asking', async () => {
      await expect(resolveSpaceAvatar('ens.eth', 1, 'eth')).resolves.toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('answers false for an onchain logo instead of asking for a field that is not there', async () => {
      await expect(resolveSpaceLogo(ADDRESS, 1, 'eth')).resolves.toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('answers false for an avatar reference that cannot become a fetchable URL', async () => {
      mockedFetch.mockResolvedValue(entry({ avatar: 'http://' }));

      await expect(resolveUserAvatar(ADDRESS)).resolves.toBe(false);
    });
  });

  describe('lens', () => {
    it('answers false for an empty local name, without asking', async () => {
      await expect(lens('.lens')).resolves.toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('answers false for a local name longer than the API parses, without asking', async () => {
      await expect(lens(`${'a'.repeat(255)}.lens`)).resolves.toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('counts what the API counts, which is bytes and not characters', async () => {
      const localName = `${'é'.repeat(127)}a`;
      expect(localName.length).toBeLessThanOrEqual(254);
      expect(Buffer.byteLength(localName)).toBe(255);

      await expect(lens(`${localName}.lens`)).resolves.toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('still asks for the longest local name the API parses', async () => {
      mockedFetch.mockResolvedValue(graphQlResponse({ account: null }));

      await expect(lens(`${'a'.repeat(254)}.lens`)).resolves.toBe(false);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    it('queries the text before the last .lens, not the text before the first one', async () => {
      mockedFetch.mockResolvedValue(graphQlResponse({ account: null }));

      await lens('a.lensb.lens');

      expect(sentVariables().request.username.localName).toBe('a.lensb');
    });
  });

  describe('coingecko', () => {
    const apiKey = process.env.COINGECKO_API_KEY;

    afterEach(() => {
      process.env.COINGECKO_API_KEY = apiKey;
    });

    it('answers false for a token the API does not have', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(loadCoingecko()(ADDRESS, '1')).resolves.toBe(false);
    });

    it('answers false for a token the API has no image for', async () => {
      mockedFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ image: {} }) });

      await expect(loadCoingecko()(ADDRESS, '1')).resolves.toBe(false);
    });

    it('rejects on any other non-2xx, carrying the status', async () => {
      mockedFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

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
