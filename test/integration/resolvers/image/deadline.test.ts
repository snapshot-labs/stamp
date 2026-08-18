import http from 'http';
import { AddressInfo, Socket } from 'net';
import { Address } from '../../../../src/helpers/types';

const ADDRESS = '0x91fd2c8d24767db4ece7069aa27832ffaf8590f3';

type Stall = 'headers' | 'body';

let mockHangingUrl: string;

let server: http.Server;
const sockets = new Set<Socket>();
let stall: Stall;

let coingecko: (address: Address, chainId: string) => Promise<Buffer | false>;
let farcaster: (address: Address) => Promise<Buffer | false>;

const apiKey = process.env.COINGECKO_API_KEY;

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    if (stall !== 'body') return;

    // A body that opens and never closes. flushHeaders puts the head on the
    // wire by itself, so the response settles for the caller while the read of
    // it cannot.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.flushHeaders();
    res.write('{"');
  });
  server.on('connection', socket => sockets.add(socket));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  mockHangingUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const realFetch = global.fetch;
  jest.spyOn(global, 'fetch').mockImplementation((_url, init) => realFetch(mockHangingUrl, init));

  process.env.COINGECKO_API_KEY = 'test-key';
  coingecko = (await import('../../../../src/resolvers/image/coingecko')).default;
  farcaster = (await import('../../../../src/resolvers/image/farcaster')).default;
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

describe('resolvers, against an upstream that never finishes answering', () => {
  describe.each([
    ['no headers at all', 'headers'],
    ['headers and then nothing more', 'body']
  ] as const)('when it sends %s', (_, at) => {
    it('farcaster raises the abort', async () => {
      stall = at;

      await expect(farcaster(ADDRESS)).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('coingecko raises the abort', async () => {
      stall = at;

      await expect(coingecko(ADDRESS, '1')).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
