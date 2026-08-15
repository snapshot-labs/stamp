import { capture } from '@snapshot-labs/snapshot-sentry';
import fetch from 'node-fetch';
import { Address, Handle } from '../../../src/utils';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('node-fetch', () => jest.fn());

const ADDRESS = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';
const CHAIN_ID = '109';
const PAGE_SIZE = 25;

const mockedFetch = fetch as unknown as jest.Mock;

let lookupDomains: (address: Address, chainId?: string) => Promise<Handle[]>;
let lookupDomainsThroughIndex: (address: Address, chains?: string | string[]) => Promise<Handle[]>;

const apiKey = process.env.D3_API_KEY_MAINNET;

beforeAll(async () => {
  process.env.D3_API_KEY_MAINNET = 'test-key';
  lookupDomains = (await import('../../../src/lookupDomains/shibarium')).default;
  lookupDomainsThroughIndex = (await import('../../../src/lookupDomains')).default;
});

afterAll(() => {
  if (apiKey === undefined) {
    delete process.env.D3_API_KEY_MAINNET;
  } else {
    process.env.D3_API_KEY_MAINNET = apiKey;
  }
});

function httpResponse(status: number, statusText: string, body: any = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}

function page(count: number) {
  return {
    pageItems: Array.from({ length: count }, (_, i) => ({ sld: `domain${i}`, tld: 'shib' }))
  };
}

describe('lookupDomains/shibarium', () => {
  it.each([
    [429, 'Too Many Requests'],
    [504, 'Gateway Timeout'],
    [401, 'Unauthorized'],
    [500, 'Internal Server Error']
  ])('throws an error carrying the HTTP status on a %i', async (status, statusText) => {
    mockedFetch.mockResolvedValue(httpResponse(status as number, statusText as string));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).rejects.toMatchObject({
      message: `HTTP ${status}: ${statusText}`,
      status
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it('throws a failure that carries no HTTP status', async () => {
    mockedFetch.mockRejectedValue(
      Object.assign(new Error('getaddrinfo ENOTFOUND api-public.interstellar.xyz'), {
        code: 'ENOTFOUND'
      })
    );

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).rejects.toThrow(
      'getaddrinfo ENOTFOUND api-public.interstellar.xyz'
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('throws when a later page fails, instead of returning the pages already collected', async () => {
    mockedFetch
      .mockResolvedValueOnce(httpResponse(200, 'OK', page(PAGE_SIZE)))
      .mockResolvedValueOnce(httpResponse(429, 'Too Many Requests'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).rejects.toMatchObject({ status: 429 });
  });

  it('returns the domains on a successful response', async () => {
    mockedFetch.mockResolvedValue(
      httpResponse(200, 'OK', { pageItems: [{ sld: 'boorger', tld: 'shib' }] })
    );

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual(['boorger.shib']);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not call the API on an unsupported chain', async () => {
    await expect(lookupDomains(ADDRESS, '1')).resolves.toEqual([]);
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('lookupDomains/shibarium through the shared handler', () => {
  it('reports a shibarium failure with the address and chain as context', async () => {
    mockedFetch.mockResolvedValue(httpResponse(500, 'Internal Server Error'));

    await expect(lookupDomainsThroughIndex(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'HTTP 500: Internal Server Error', status: 500 }),
      {
        tags: { provider: 'Shibarium' },
        contexts: { input: { address: ADDRESS, chainId: CHAIN_ID } }
      }
    );
  });

  it('still silences a rate limit', async () => {
    mockedFetch.mockResolvedValue(httpResponse(429, 'Too Many Requests'));

    await expect(lookupDomainsThroughIndex(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('drops the pages already collected when a later page fails', async () => {
    mockedFetch
      .mockResolvedValueOnce(httpResponse(200, 'OK', page(PAGE_SIZE)))
      .mockResolvedValueOnce(httpResponse(500, 'Internal Server Error'));

    await expect(lookupDomainsThroughIndex(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
