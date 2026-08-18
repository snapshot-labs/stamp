import http from 'http';
import { AddressInfo, Socket } from 'net';
import { isSilencedError } from '../../../src/helpers/errors';
import { fetchHttpImage, fetchHttpResponse } from '../../../src/helpers/http';

const BODY = Buffer.from('as much of an image as the fetch cares about');

let server: http.Server;
let url: string;
let missingUrl: string;
let activeStreamUrl: string;
let neverEndingUrl: string;
const sockets = new Set<Socket>();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/missing.png') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<html><body>not found</body></html>');
    }

    res.writeHead(200, { 'Content-Type': 'image/png' });

    if (req.url === '/image.png') return res.end(BODY);

    if (req.url === '/active-stream.png') {
      res.flushHeaders();
      let sent = 0;
      const timer = setInterval(() => {
        res.write('x');
        sent += 1;
        if (sent === 12) {
          clearInterval(timer);
          res.end('done');
        }
      }, 100);
      res.on('close', () => clearInterval(timer));
      return;
    }

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
  activeStreamUrl = `${origin}/active-stream.png`;
  neverEndingUrl = `${origin}/never-ends.png`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('fetchHttpResponse', () => {
  it('allows an active response to outlive its inactivity budget', async () => {
    const { body } = await fetchHttpResponse(activeStreamUrl, {}, 500);

    expect(body).toEqual(Buffer.from(`${'x'.repeat(12)}done`));
  });

  it('aborts a response that stays idle for its inactivity budget', async () => {
    const error = await fetchHttpResponse(neverEndingUrl, {}, 100).catch(err => err);

    expect(error.name).toBe('AbortError');
  });
});

describe('fetchHttpImage', () => {
  it('returns the body', async () => {
    await expect(fetchHttpImage(url)).resolves.toEqual(BODY);
  });

  it('raises rather than returning the body of a non-2xx', async () => {
    await expect(fetchHttpImage(missingUrl)).rejects.toMatchObject({ status: 404 });
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
