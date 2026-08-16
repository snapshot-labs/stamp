import http from 'http';
import { AddressInfo, Socket } from 'net';
import { isSilencedError } from '../../../src/helpers/errors';
import { fetchHttpImage } from '../../../src/helpers/http';

const BODY = Buffer.from('as much of an image as the fetch cares about');

let server: http.Server;
let url: string;
let drip = false;
const sockets = new Set<Socket>();

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png' });

    if (!drip) return res.end(BODY);

    // A body that keeps arriving and never ends. The socket is never idle, so
    // this is the shape that outlives a budget measured per request.
    res.flushHeaders();
    const timer = setInterval(() => res.write('x'), 250);
    res.on('close', () => clearInterval(timer));
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/image.png`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('fetchHttpImage', () => {
  it('returns the body', async () => {
    drip = false;

    await expect(fetchHttpImage(url)).resolves.toEqual(BODY);
  });

  // Silenced as well as raised: every image resolver reaches this, and an abort
  // that the classifier cannot read reports a slow upstream as a failure.
  it('raises a silenced abort against an upstream that never stops sending', async () => {
    drip = true;

    const error = await fetchHttpImage(url).catch(err => err);

    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });
});
