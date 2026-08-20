import http from 'http';
import { AddressInfo, Socket } from 'net';
import { isSilencedError } from '../../../src/helpers/errors';
import { fetchHttpImage } from '../../../src/helpers/http';

const BODY = Buffer.from('as much of an image as the fetch cares about');

let server: http.Server;
let url: string;
let missingUrl: string;
let nonImageUrl: string;
let mixedCaseUrl: string;
let neverEndingUrl: string;
let resolveNonImageClosed!: () => void;
const nonImageClosed = new Promise<void>(resolve => {
  resolveNonImageClosed = resolve;
});
const sockets = new Set<Socket>();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/missing.png') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<html><body>not found</body></html>');
    }

    if (req.url === '/not-an-image.png') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.flushHeaders();
      const timer = setInterval(() => res.write('x'), 50);
      res.on('close', () => {
        clearInterval(timer);
        resolveNonImageClosed();
      });
      return;
    }

    if (req.url === '/mixed-case.png') {
      res.writeHead(200, { 'Content-Type': 'Image/PNG' });
      return res.end(BODY);
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
  nonImageUrl = `${origin}/not-an-image.png`;
  mixedCaseUrl = `${origin}/mixed-case.png`;
  neverEndingUrl = `${origin}/never-ends.png`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('fetchHttpImage', () => {
  it('returns the body', async () => {
    await expect(fetchHttpImage(url)).resolves.toEqual(BODY);
  });

  it('raises rather than returning the body of a non-2xx', async () => {
    await expect(fetchHttpImage(missingUrl)).rejects.toMatchObject({ status: 404 });
  });

  it('raises a routine miss and closes a streaming non-image body', async () => {
    await expect(fetchHttpImage(nonImageUrl)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('not an image: text/html; charset=utf-8')
    });
    await expect(nonImageClosed).resolves.toBeUndefined();
  });

  it('accepts a valid image media type regardless of case', async () => {
    await expect(fetchHttpImage(mixedCaseUrl)).resolves.toEqual(BODY);
  });

  it('raises a silenced abort against an upstream that never stops sending', async () => {
    const error = await fetchHttpImage(neverEndingUrl).catch(err => err);

    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });

  it('gives up on that upstream inside its own budget rather than the shared one', async () => {
    const startedAt = Date.now();
    await fetchHttpImage(neverEndingUrl).catch(() => undefined);

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThan(3000);
    expect(elapsed).toBeLessThan(8000);
  });
});
