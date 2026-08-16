import { capture } from '@snapshot-labs/snapshot-sentry';
import fetch from 'node-fetch';
import { timeLookupDomainsResponse } from '../../../src/helpers/metrics';
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
  it.each<[number, string]>([
    [429, 'Too Many Requests'],
    [504, 'Gateway Timeout'],
    [401, 'Unauthorized'],
    [500, 'Internal Server Error']
  ])('throws an error carrying the HTTP status on a %i', async (status, statusText) => {
    mockedFetch.mockResolvedValue(httpResponse(status, statusText));

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

function abortError() {
  return Object.assign(new Error('The user aborted a request.'), {
    name: 'AbortError',
    type: 'aborted'
  });
}

async function recordedFor(provider: string) {
  const metric: any = await timeLookupDomainsResponse.get();

  return metric.values
    .filter((v: any) => String(v.metricName).endsWith('_count') && v.labels.provider === provider)
    .map((v: any) => ({ chainId: v.labels.chainId, status: v.labels.status, count: v.value }));
}

describe('lookupDomains/shibarium deadline', () => {
  it('still aborts the request once the deadline passes', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const signals: AbortSignal[] = [];
    mockedFetch.mockImplementation(
      (_url: string, options: any) =>
        new Promise((_resolve, reject) => {
          signals.push(options.signal);
          options.signal.addEventListener('abort', () => reject(abortError()));
        })
    );

    const result = lookupDomains(ADDRESS, CHAIN_ID);
    await Promise.resolve();

    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    const deadline = timers.mock.calls.find(call => call[1] === 10000);
    expect(deadline).toBeDefined();
    (deadline as unknown as [() => void])[0]();

    await expect(result).rejects.toThrow('The user aborted a request.');
    expect(signals[0].aborted).toBe(true);
    timers.mockRestore();
  });

  it('does not report an abort, and still records it in the metric', async () => {
    timeLookupDomainsResponse.reset();
    mockedFetch.mockRejectedValue(abortError());

    await expect(lookupDomainsThroughIndex(ADDRESS, CHAIN_ID)).resolves.toEqual([]);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
    expect(await recordedFor('Shibarium')).toEqual([{ chainId: CHAIN_ID, status: 0, count: 1 }]);
  });

  it('records a success as status 1', async () => {
    timeLookupDomainsResponse.reset();
    mockedFetch.mockResolvedValue(
      httpResponse(200, 'OK', { pageItems: [{ sld: 'boorger', tld: 'shib' }] })
    );

    await expect(lookupDomainsThroughIndex(ADDRESS, CHAIN_ID)).resolves.toEqual(['boorger.shib']);
    expect(await recordedFor('Shibarium')).toEqual([{ chainId: CHAIN_ID, status: 1, count: 1 }]);
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
