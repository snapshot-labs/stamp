import { DNSConnect } from '@webinterop/dns-connect';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/shibarium';
import { isSilencedError } from '../../../../src/resolvers/address/utils';

jest.mock('@webinterop/dns-connect', () => ({
  DNSConnect: jest.fn()
}));

const ADDRESSES = [
  '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6',
  '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
  '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046'
];
const HANDLES = ['boorger.shib', 'second.shib', 'third.shib'];
const TIMEOUT = 10000;

const mockedDNSConnect = DNSConnect as unknown as jest.Mock;

type Query = 'resolve' | 'reverseResolve';
type Case = [string, Query, string[], (entries: string[]) => Promise<Record<string, string>>];

function mockQuery(method: Query, query: (entry: string) => Promise<unknown>) {
  mockedDNSConnect.mockImplementation(() => ({ [method]: query }));
}

function deadlines(timers: jest.SpyInstance) {
  return timers.mock.calls.filter(call => call[1] === TIMEOUT);
}

describe.each<Case>([
  ['lookupAddresses', 'reverseResolve', ADDRESSES, lookupAddresses],
  ['resolveNames', 'resolve', HANDLES, resolveNames]
])('resolvers/address/shibarium %s deadline', (_name, method, entries, call) => {
  it('ends the call, on queries that never settle and take no signal of their own', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    const started: string[] = [];

    // dns-connect forwards no signal, so a hung DNS-over-HTTPS request is
    // indistinguishable from a promise that simply never settles.
    mockQuery(method, entry => {
      started.push(entry);
      return new Promise(() => undefined);
    });

    const result = call(entries);

    expect(started).toEqual(entries);

    const scheduled = deadlines(timers);
    expect(scheduled).toHaveLength(1);
    scheduled[0][0]();

    const error = await result.catch(err => err);
    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });

  it('spends one budget on the whole fan-out, not one per entry', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    mockQuery(method, async entry => `${entry}-result`);

    await expect(call(entries)).resolves.toEqual(
      Object.fromEntries(entries.map(entry => [entry, `${entry}-result`]))
    );
    expect(deadlines(timers)).toHaveLength(1);
  });
});
