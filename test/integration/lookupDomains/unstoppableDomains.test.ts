import lookupDomains, { DEFAULT_CHAIN_ID } from '../../../src/lookupDomains/unstoppableDomains';

const ADDRESS = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';

function mockFetch(response: { status: number; statusText: string; body: any }) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    json: async () => response.body
  } as Response);
}

// This resolver reports nothing itself: it throws the original error and
// lookupDomains/index.ts decides whether to capture it. What matters here is
// that the thrown error carries the HTTP status as data, since isSilencedError
// reads the status off the error and never out of the message text. Which
// statuses get silenced is covered in addressResolvers/utils.test.ts.
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

  it.each([
    [429, 'Too Many Requests'],
    [504, 'Gateway Timeout'],
    [500, 'Internal Server Error'],
    [401, 'Unauthorized']
  ])('throws an error carrying the HTTP status on a %i', async (status, statusText) => {
    mockFetch({ status: status as number, statusText: statusText as string, body: {} });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toMatchObject({
      message: `Unstoppable Domains API error: HTTP ${status} ${statusText}`,
      status
    });
  });

  it('throws a descriptive error when a 200 body has no data array', async () => {
    mockFetch({ status: 200, statusText: 'OK', body: { next: null } });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.toThrow(
      'Unstoppable Domains API error: response body is missing a data array'
    );
  });

  it('never throws a TypeError on a non-200 response', async () => {
    mockFetch({ status: 500, statusText: 'Internal Server Error', body: {} });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).rejects.not.toBeInstanceOf(TypeError);
  });

  it('returns the domains on a successful response', async () => {
    mockFetch({
      status: 200,
      statusText: 'OK',
      body: { data: [{ meta: { domain: 'boorger.sonic' } }], next: null }
    });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).resolves.toEqual(['boorger.sonic']);
  });

  it('does not call the API on an unsupported chain', async () => {
    const fetchSpy = mockFetch({ status: 200, statusText: 'OK', body: { data: [], next: null } });

    await expect(lookupDomains(ADDRESS, '1')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
