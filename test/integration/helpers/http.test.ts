import http from 'http';
import { AddressInfo, Socket } from 'net';
import { isSilencedError } from '../../../src/helpers/errors';
import { fetchHttpImage, MAX_IMAGE_BYTES } from '../../../src/helpers/http';
import { unguardedDispatcher } from '../../helpers/fetch';

const BODY = Buffer.from('as much of an image as the fetch cares about');
const CHUNK = Buffer.alloc(1024 * 1024, 'x');

let server: http.Server;
let url: string;
let missingUrl: string;
let neverEndingUrl: string;
let oversizedDeclaredUrl: string;
let oversizedStreamedUrl: string;
let closed: Promise<void>;
let resolveClosed: () => void = () => {};
const sockets = new Set<Socket>();

function closesWithin(ms: number): Promise<boolean> {
  return Promise.race([
    closed.then(() => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms))
  ]);
}

function armClosedWatcher(): void {
  closed = new Promise<void>(resolve => {
    resolveClosed = resolve;
  });
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/missing.png') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<html><body>not found</body></html>');
    }

    if (req.url === '/oversized-declared.png') {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': String(MAX_IMAGE_BYTES + 1)
      });
      res.on('close', () => resolveClosed());
      return res.write('x');
    }

    if (req.url === '/oversized-streamed.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      let clientGone = false;
      res.on('close', () => {
        clientGone = true;
        resolveClosed();
      });
      let sent = 0;
      const write = () => {
        if (clientGone || sent > MAX_IMAGE_BYTES + CHUNK.length) return res.end();
        sent += CHUNK.length;
        res.write(CHUNK, () => write());
      };
      return write();
    }

    res.writeHead(200, { 'Content-Type': 'image/png' });

    if (req.url === '/image.png') return res.end(BODY);

    res.flushHeaders();
    const timer = setInterval(() => res.write('x'), 250);
    res.on('close', () => clearInterval(timer));
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  url = `${origin}/image.png`;
  missingUrl = `${origin}/missing.png`;
  neverEndingUrl = `${origin}/never-ends.png`;
  oversizedDeclaredUrl = `${origin}/oversized-declared.png`;
  oversizedStreamedUrl = `${origin}/oversized-streamed.png`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('fetchHttpImage', () => {
  it('returns the body', async () => {
    await expect(fetchHttpImage(url, unguardedDispatcher)).resolves.toEqual(BODY);
  });

  it('raises rather than returning the body of a non-2xx', async () => {
    await expect(fetchHttpImage(missingUrl, unguardedDispatcher)).rejects.toMatchObject({
      status: 404
    });
  });

  it('rejects a declared length over the cap without reading the body', async () => {
    armClosedWatcher();

    await expect(fetchHttpImage(oversizedDeclaredUrl)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('image too large')
    });
    await expect(closesWithin(1000)).resolves.toBe(true);
  });

  it('rejects a body that crosses the cap while streaming, with no declared length', async () => {
    armClosedWatcher();

    await expect(fetchHttpImage(oversizedStreamedUrl)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('image too large')
    });
    await expect(closesWithin(1000)).resolves.toBe(true);
  });

  it('raises a silenced abort against an upstream that never stops sending', async () => {
    const error = await fetchHttpImage(neverEndingUrl, unguardedDispatcher).catch(err => err);

    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });

  it('gives up on that upstream inside its own budget rather than the shared one', async () => {
    const startedAt = Date.now();
    await fetchHttpImage(neverEndingUrl, unguardedDispatcher).catch(() => undefined);

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThan(3000);
    expect(elapsed).toBeLessThan(8000);
  });
});
