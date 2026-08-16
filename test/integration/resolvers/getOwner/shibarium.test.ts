import { DNSConnect } from '@webinterop/dns-connect';
import { Address, Handle } from '../../../../src/helpers/types';

jest.mock('@webinterop/dns-connect', () => ({
  DNSConnect: jest.fn()
}));

const HANDLE = 'boorger.shib';
const CHAIN_ID = '109';
const TIMEOUT = 10000;

const mockedDNSConnect = DNSConnect as unknown as jest.Mock;

let getOwner: (handle: Handle, chainId?: string) => Promise<Address>;

const apiKey = process.env.D3_API_KEY_MAINNET;

beforeAll(async () => {
  process.env.D3_API_KEY_MAINNET = 'test-key';
  getOwner = (await import('../../../../src/resolvers/getOwner/shibarium')).default;
});

afterAll(() => {
  if (apiKey === undefined) {
    delete process.env.D3_API_KEY_MAINNET;
  } else {
    process.env.D3_API_KEY_MAINNET = apiKey;
  }
});

// Registered but with no `owner`, which is the shape that sends getOwner on to
// the DNS resolution path.
function unclaimed() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      status: 'registered',
      expirationDate: new Date(Date.now() + 86400e3).toISOString()
    })
  } as Response;
}

describe('getOwner/shibarium deadline', () => {
  it('bounds the DNS resolution, which takes no signal of its own', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'fetch').mockResolvedValue(unclaimed());

    let reachedDNS: () => void;
    const atDNS = new Promise<void>(resolve => (reachedDNS = resolve));

    // dns-connect never forwards a signal, so a hung DNS-over-HTTPS request is
    // indistinguishable from a promise that simply never settles.
    mockedDNSConnect.mockImplementation(() => ({
      resolve: () => {
        reachedDNS();
        return new Promise(() => undefined);
      }
    }));

    const result = getOwner(HANDLE, CHAIN_ID);
    await atDNS;

    const deadlines = timers.mock.calls.filter(call => call[1] === TIMEOUT);
    expect(deadlines).toHaveLength(2);
    (deadlines[1] as unknown as [() => void])[0]();

    await expect(result).rejects.toThrow('This operation was aborted');

    timers.mockRestore();
  });
});
