import http from 'http';
import { AddressInfo, Socket } from 'net';
import { fetchHttpImage } from '../../../src/helpers/http';
import { unguardedDispatcher } from '../../helpers/fetch';

const ANNOUNCED = 5_000_000;
const WRITTEN = 200_000;

let server: http.Server;
let url: string;
let hungUp: Promise<boolean>;
const sockets = new Set<Socket>();

function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([work, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);
}

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    hungUp = new Promise<boolean>(resolve => {
      res.on('close', () => resolve(true));
    });

    res.writeHead(500, { 'Content-Type': 'text/html', 'Content-Length': String(ANNOUNCED) });
    res.write('x'.repeat(WRITTEN));
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/upstream.png`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('a response rejected before its body is read', () => {
  it('ends the request rather than leaving the upstream writing', async () => {
    await expect(fetchHttpImage(url, unguardedDispatcher)).rejects.toMatchObject({ status: 500 });

    await expect(within(hungUp, 2000, false)).resolves.toBe(true);
  });
});
