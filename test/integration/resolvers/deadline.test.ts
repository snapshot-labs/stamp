import http from 'http';
import { Address } from '../../../src/utils';

const TIMEOUT = 10000;
const ADDRESS = '0x91fd2c8d24767db4ece7069aa27832ffaf8590f3';

// Both resolvers hold their upstream as a module constant, so the only place a
// server that never answers can be substituted is the transport.
let mockHangingUrl: string;

jest.mock('node-fetch', () => {
  const actual = jest.requireActual('node-fetch');

  return jest.fn((_url: string, init: unknown) => actual(mockHangingUrl, init));
});

const realFetch = global.fetch;

let server: http.Server;
const sockets = new Set<any>();
let reachedUpstream: () => void;
let atUpstream: Promise<void>;

let coingecko: (address: Address, chainId: string) => Promise<Buffer | false>;
let farcaster: (address: Address) => Promise<Buffer | false>;

const apiKey = process.env.COINGECKO_API_KEY;

beforeAll(async () => {
  server = http.createServer(() => reachedUpstream());
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  mockHangingUrl = `http://127.0.0.1:${(server.address() as any).port}/`;

  process.env.COINGECKO_API_KEY = 'test-key';
  coingecko = (await import('../../../src/resolvers/coingecko')).default;
  farcaster = (await import('../../../src/resolvers/farcaster')).default;
});

afterAll(async () => {
  if (apiKey === undefined) {
    delete process.env.COINGECKO_API_KEY;
  } else {
    process.env.COINGECKO_API_KEY = apiKey;
  }

  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  atUpstream = new Promise<void>(resolve => (reachedUpstream = resolve));
  jest.spyOn(global, 'fetch').mockImplementation((_url, init) => realFetch(mockHangingUrl, init));
});

// Fires the deadline as soon as the request is in flight, rather than waiting
// out the real ten seconds.
async function callAndExpire<T>(call: () => Promise<T>): Promise<T> {
  const timers = jest.spyOn(global, 'setTimeout');

  try {
    const result = call();
    await atUpstream;

    const deadlines = timers.mock.calls.filter(timer => timer[1] === TIMEOUT);
    expect(deadlines).toHaveLength(1);
    (deadlines[0] as unknown as [() => void])[0]();

    return await result;
  } finally {
    timers.mockRestore();
  }
}

describe('resolvers, against an upstream that accepts and never answers', () => {
  it('farcaster answers false at the deadline, as it does for any other failure', async () => {
    await expect(callAndExpire(() => farcaster(ADDRESS))).resolves.toBe(false);
  });

  it('coingecko raises the abort, which isSilencedError matches by name', async () => {
    await expect(callAndExpire(() => coingecko(ADDRESS, '1'))).rejects.toMatchObject({
      name: 'AbortError'
    });
  });
});
