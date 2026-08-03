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
  const apiKey = process.env.D3_API_KEY_MAINNET;

  beforeAll(async () => {
    process.env.D3_API_KEY_MAINNET = 'test-key';
    lookupDomains = (await import('../../../src/lookupDomains/shibarium')).default;
  });

  afterAll(() => {
    if (apiKey === undefined) {
      delete process.env.D3_API_KEY_MAINNET;
    } else {
      process.env.D3_API_KEY_MAINNET = apiKey;
    }
  });

  it('does not report a rate limit to Sentry', async () => {
    mockedFetch.mockResolvedValue(httpResponse(429, 'Too Many Requests'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not report a gateway timeout to Sentry', async () => {
    mockedFetch.mockResolvedValue(httpResponse(504, 'Gateway Timeout'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports the HTTP status when the API rejects the credentials', async () => {
    mockedFetch.mockResolvedValue(httpResponse(401, 'Unauthorized'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'HTTP 401: Unauthorized', status: 401 }),
      { input: { address: ADDRESS, chainId: CHAIN_ID, skip: 0 } }
    );
  });

  it('reports a server error to Sentry', async () => {
    mockedFetch.mockResolvedValue(httpResponse(500, 'Internal Server Error'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'HTTP 500: Internal Server Error', status: 500 }),
      { input: { address: ADDRESS, chainId: CHAIN_ID, skip: 0 } }
    );
  });

  it('reports a failure that carries no HTTP status', async () => {
    mockedFetch.mockRejectedValue(
      Object.assign(new Error('getaddrinfo ENOTFOUND api-public.interstellar.xyz'), {
        code: 'ENOTFOUND'
      })
    );

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'getaddrinfo ENOTFOUND api-public.interstellar.xyz' }),
      { input: { address: ADDRESS, chainId: CHAIN_ID, skip: 0 } }
    );
  });

  it('keeps the domains collected before a rate limit interrupts pagination', async () => {
    mockedFetch
      .mockResolvedValueOnce(httpResponse(200, 'OK', page(PAGE_SIZE)))
      .mockResolvedValueOnce(httpResponse(429, 'Too Many Requests'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toHaveLength(PAGE_SIZE);
    expect(capture).not.toHaveBeenCalled();
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
