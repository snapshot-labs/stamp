import { capture } from '@snapshot-labs/snapshot-sentry';
import { timeLookupDomainsResponse } from '../../../src/helpers/metrics';
import lookupDomainsThroughIndex from '../../../src/lookupDomains';
import lookupDomains, { DEFAULT_CHAIN_ID } from '../../../src/lookupDomains/unstoppableDomains';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

const ADDRESS = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';
const TIMEOUT = 10000;

function mockFetch(response: { status: number; statusText: string; body: any }) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    json: async () => response.body
  } as Response);
}

function abortError() {
  return Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
}

async function recordedFor(provider: string) {
  const metric: any = await timeLookupDomainsResponse.get();

  return metric.values
    .filter((v: any) => String(v.metricName).endsWith('_count') && v.labels.provider === provider)
    .map((v: any) => ({ chainId: v.labels.chainId, status: v.labels.status, count: v.value }));
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

describe('lookupDomains/unstoppableDomains deadline', () => {
  const apiKey = process.env.UNSTOPPABLE_DOMAINS_API_KEY;

  beforeEach(() => {
    process.env.UNSTOPPABLE_DOMAINS_API_KEY = 'test-key';
    timeLookupDomainsResponse.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (apiKey === undefined) {
      delete process.env.UNSTOPPABLE_DOMAINS_API_KEY;
    } else {
      process.env.UNSTOPPABLE_DOMAINS_API_KEY = apiKey;
    }
  });

  it('aborts the request once the deadline passes', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const signals: AbortSignal[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url: any, options: any) =>
        new Promise((_resolve, reject) => {
          signals.push(options.signal);
          options.signal.addEventListener('abort', () => reject(abortError()));
        })
    );

    const result = lookupDomains(ADDRESS, DEFAULT_CHAIN_ID);
    await Promise.resolve();

    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    const deadline = timers.mock.calls.find(call => call[1] === TIMEOUT);
    expect(deadline).toBeDefined();
    (deadline as unknown as [() => void])[0]();

    await expect(result).rejects.toThrow('This operation was aborted');
    expect(signals[0].aborted).toBe(true);
  });

  it('sets one deadline for the whole call, not one per page', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const signals: AbortSignal[] = [];
    jest.spyOn(global, 'fetch').mockImplementation((_url: any, options: any) => {
      signals.push(options.signal);
      const body =
        signals.length === 1
          ? { data: [{ meta: { domain: 'first.sonic' } }], next: '?cursor=1' }
          : { data: [{ meta: { domain: 'second.sonic' } }], next: null };

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => body
      } as Response);
    });

    await expect(lookupDomains(ADDRESS, DEFAULT_CHAIN_ID)).resolves.toEqual([
      'first.sonic',
      'second.sonic'
    ]);
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(new Set(signals).size).toBe(1);
    expect(timers.mock.calls.filter(call => call[1] === TIMEOUT)).toHaveLength(1);
  });

  it('does not report an abort, and still records it in the metric', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(abortError());

    await expect(lookupDomainsThroughIndex(ADDRESS, DEFAULT_CHAIN_ID)).resolves.toEqual([]);
    expect(capture).not.toHaveBeenCalled();
    expect(await recordedFor('Unstoppable Domains')).toEqual([
      { chainId: DEFAULT_CHAIN_ID, status: 0, count: 1 }
    ]);
  });
});
