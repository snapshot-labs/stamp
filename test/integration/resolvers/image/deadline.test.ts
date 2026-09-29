jest.mock('../../../../src/helpers/deadline', () =>
  jest.requireActual('../../../helpers/deadline')
);

import http from 'http';
import { AddressInfo, Socket } from 'net';
import { withDeadline } from '../../../../src/helpers/deadline';
import { Address } from '../../../../src/helpers/types';
import { shortenNextDeadline } from '../../../helpers/deadline';

const ADDRESS = '0x91fd2c8d24767db4ece7069aa27832ffaf8590f3';

type Stall = 'headers' | 'body';

let server: http.Server;
const sockets = new Set<Socket>();
let stall: Stall;
let answered: boolean;

let defillama: (address: Address, chainId: string) => Promise<Buffer | false>;
let farcaster: (address: Address) => Promise<Buffer | false>;

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    if (stall !== 'body') return;

    // A body that opens and never closes. flushHeaders puts the head on the
    // wire by itself, so the response settles for the caller while the read of
    // it cannot. The head has to be an image one: the image reader turns any
    // other type away before it reads a byte, while farcaster's JSON read never
    // looks at the type.
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.flushHeaders();
    res.write('{"');
  });
  server.on('connection', socket => sockets.add(socket));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const mockHangingUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const realFetch = global.fetch;
  jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    const response = await realFetch(mockHangingUrl, init);
    answered = true;
    return response;
  });

  defillama = (await import('../../../../src/resolvers/image/defillama')).default;
  farcaster = (await import('../../../../src/resolvers/image/farcaster')).default;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

// The body case is the one that needs the deadline to cover more than the
// request: a response settles for the caller as soon as the headers land, so a
// 200 whose body then stops is the shape that outlives a budget ending at the
// request.
describe('resolvers, against an upstream that never finishes answering', () => {
  describe.each([
    ['no headers at all', 'headers'],
    ['headers and then nothing more', 'body']
  ] as const)('when it sends %s', (_, at) => {
    beforeEach(() => {
      stall = at;
      answered = false;
      shortenNextDeadline();
    });

    // A head that lands after the shortened deadline would turn the body case
    // into the headers one.
    afterEach(() => {
      expect(answered).toBe(at === 'body');
    });

    it('farcaster raises the abort', async () => {
      await expect(farcaster(ADDRESS)).rejects.toMatchObject({ name: 'AbortError' });
      expect(withDeadline).toHaveBeenCalledWith(expect.any(Function));
    });

    it('defillama raises the abort', async () => {
      await expect(defillama(ADDRESS, '1')).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
