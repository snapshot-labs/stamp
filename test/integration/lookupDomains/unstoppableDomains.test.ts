import { capture } from '@snapshot-labs/snapshot-sentry';
import { FetchError } from '../../../src/addressResolvers/utils';
import lookupDomains, { DEFAULT_CHAIN_ID } from '../../../src/lookupDomains/unstoppableDomains';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

const ADDRESS = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';

function mockFetch(response: { status: number; statusText: string; body: any }) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    json: async () => response.body
  } as Response);
}

describe('lookupDomains/unstoppableDomains', () => {
  const apiKey = process.env.UNSTOPPABLE_DOMAINS_API_KEY;

  beforeEach(() => {
    process.env.UNSTOPPABLE_DOMAINS_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (apiKey === undefined) {
      delete process.env.UNSTOPPABLE_DOMAINS_API_KEY;
    } else {
      process.env.UNSTOPPABLE_DOMAINS_API_KEY = apiKey;
    }
  });

  it('does not report a rate limit to Sentry', async () => {
    mockFetch({
      status: 429,
      statusText: 'Too Many Requests',
      body: { message: 'API rate limit exceeded' }
    });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toBeInstanceOf(FetchError);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not report a gateway timeout to Sentry', async () => {
    mockFetch({ status: 504, statusText: 'Gateway Timeout', body: {} });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toBeInstanceOf(FetchError);
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports a server error to Sentry', async () => {
    mockFetch({ status: 500, statusText: 'Internal Server Error', body: {} });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toBeInstanceOf(FetchError);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unstoppable Domains API error: HTTP 500 Internal Server Error'
      }),
      { input: { address: ADDRESS } }
    );
  });

  it('reports the HTTP status when the API rejects the credentials', async () => {
    mockFetch({
      status: 401,
      statusText: 'Unauthorized',
      body: { message: 'Invalid authentication credentials' }
    });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toBeInstanceOf(FetchError);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unstoppable Domains API error: HTTP 401 Unauthorized'
      }),
      { input: { address: ADDRESS } }
    );
  });

  it('reports a descriptive error when a 200 body has no data array', async () => {
    mockFetch({ status: 200, statusText: 'OK', body: { next: null } });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toBeInstanceOf(FetchError);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unstoppable Domains API error: response body is missing a data array'
      }),
      { input: { address: ADDRESS } }
    );
  });

  it('never surfaces a TypeError to Sentry on a non-200 response', async () => {
    mockFetch({ status: 500, statusText: 'Internal Server Error', body: {} });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toBeInstanceOf(FetchError);
    expect(capture).not.toHaveBeenCalledWith(expect.any(TypeError), expect.anything());
  });

  it('returns the domains on a successful response', async () => {
    mockFetch({
      status: 200,
      statusText: 'OK',
      body: { data: [{ meta: { domain: 'boorger.sonic' } }], next: null }
    });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).resolves.toEqual(['boorger.sonic']);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not call the API on an unsupported chain', async () => {
    const fetchSpy = mockFetch({ status: 200, statusText: 'OK', body: { data: [], next: null } });

    await expect(lookupDomains(ADDRESS, '1')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
