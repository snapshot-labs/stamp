import http from 'http';
import { AddressInfo, Socket } from 'net';
import { isSilencedError } from '../../../src/helpers/errors';
import { fetchHttpImage, MAX_IMAGE_BYTES } from '../../../src/helpers/http';

const BODY = Buffer.from('as much of an image as the fetch cares about');
const CHUNK = Buffer.alloc(1024 * 1024, 'x');

let server: http.Server;
let farServer: http.Server;
let farOrigin: string;
let url: string;
let missingUrl: string;
let nonImageUrl: string;
let mixedCaseUrl: string;
let undeclaredUrl: string;
let emptyUrl: string;
let emptyUndeclaredUrl: string;
let neverEndingUrl: string;
let oversizedDeclaredUrl: string;
let oversizedStreamedUrl: string;
let slowErrorUrl: string;
let redirectingMissingUrl: string;
let nonImageClosed!: Promise<void>;
let resolveNonImageClosed!: () => void;
let oversizedDeclaredClosed!: Promise<void>;
let resolveOversizedDeclaredClosed!: () => void;
let oversizedStreamedClosed!: Promise<void>;
let resolveOversizedStreamedClosed!: () => void;
let slowErrorClosed!: Promise<void>;
let resolveSlowErrorClosed!: () => void;
const sockets = new Set<Socket>();

function streamForever(res: http.ServerResponse, resolveClosed: () => void) {
  res.flushHeaders();
  const timer = setInterval(() => res.write('x'), 50);
  res.on('close', () => {
    clearInterval(timer);
    resolveClosed();
  });
}

async function closesWithin(promise: Promise<void>, ms: number): Promise<boolean> {
  let timer!: NodeJS.Timeout;
  const timedOut = new Promise<boolean>(resolve => {
    timer = setTimeout(() => resolve(false), ms);
  });

  try {
    return await Promise.race([promise.then(() => true), timedOut]);
  } finally {
    clearTimeout(timer);
  }
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
      res.on('close', () => resolveOversizedDeclaredClosed());
      return res.write('x');
    }

    if (req.url === '/oversized-streamed.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      let clientGone = false;
      res.on('close', () => {
        clientGone = true;
        resolveOversizedStreamedClosed();
      });
      let sent = 0;
      const write = () => {
        if (clientGone || sent > MAX_IMAGE_BYTES + CHUNK.length) return res.end();
        sent += CHUNK.length;
        res.write(CHUNK, () => write());
      };
      return write();
    }

    if (req.url === '/not-an-image.png') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return streamForever(res, resolveNonImageClosed);
    }

    if (req.url === '/redirect-missing.png') {
      res.writeHead(302, { Location: `${farOrigin}/far-missing.png` });
      return res.end();
    }

    if (req.url === '/slow-error.png') {
      res.writeHead(504, { 'Content-Type': 'text/html' });
      return streamForever(res, resolveSlowErrorClosed);
    }

    if (req.url === '/mixed-case.png') {
      res.writeHead(200, { 'Content-Type': 'Image/PNG' });
      return res.end(BODY);
    }

    if (req.url === '/undeclared.png') {
      res.writeHead(200);
      return res.end(BODY);
    }

    if (req.url === '/empty.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end();
    }

    if (req.url === '/empty-undeclared.png') {
      res.writeHead(200);
      return res.end();
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
  farServer = http.createServer((req, res) => {
    if (req.url === '/far-missing.png') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<html><body>not found</body></html>');
    }

    res.writeHead(404);
    res.end();
  });
  await new Promise<void>(resolve => farServer.listen(0, '127.0.0.1', () => resolve()));
  farOrigin = `http://127.0.0.1:${(farServer.address() as AddressInfo).port}`;

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  url = `${origin}/image.png`;
  missingUrl = `${origin}/missing.png`;
  nonImageUrl = `${origin}/not-an-image.png`;
  mixedCaseUrl = `${origin}/mixed-case.png`;
  undeclaredUrl = `${origin}/undeclared.png`;
  emptyUrl = `${origin}/empty.png`;
  emptyUndeclaredUrl = `${origin}/empty-undeclared.png`;
  neverEndingUrl = `${origin}/never-ends.png`;
  oversizedDeclaredUrl = `${origin}/oversized-declared.png`;
  oversizedStreamedUrl = `${origin}/oversized-streamed.png`;
  slowErrorUrl = `${origin}/slow-error.png`;
  redirectingMissingUrl = `${origin}/redirect-missing.png`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
  await new Promise<void>(resolve => farServer.close(() => resolve()));
});

describe('fetchHttpImage', () => {
  it('returns the body', async () => {
    await expect(fetchHttpImage(url)).resolves.toEqual(BODY);
  });

  it('raises rather than returning the body of a non-2xx', async () => {
    await expect(fetchHttpImage(missingUrl)).rejects.toMatchObject({ status: 404 });
  });

  it('reports the host that answered a redirect, not the host that was asked', async () => {
    const farHost = new URL(farOrigin).host;

    await expect(fetchHttpImage(redirectingMissingUrl)).rejects.toMatchObject({
      status: 404,
      message: `[${farHost}] Not Found`
    });
  });

  it('rejects a declared length over the cap without reading the body', async () => {
    oversizedDeclaredClosed = new Promise<void>(resolve => {
      resolveOversizedDeclaredClosed = resolve;
    });

    await expect(fetchHttpImage(oversizedDeclaredUrl)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('image too large')
    });
    await expect(closesWithin(oversizedDeclaredClosed, 1000)).resolves.toBe(true);
  });

  it('rejects a body that crosses the cap while streaming, with no declared length', async () => {
    oversizedStreamedClosed = new Promise<void>(resolve => {
      resolveOversizedStreamedClosed = resolve;
    });

    await expect(fetchHttpImage(oversizedStreamedUrl)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('image too large')
    });
    await expect(closesWithin(oversizedStreamedClosed, 1000)).resolves.toBe(true);
  });

  it('raises a routine miss and closes a streaming non-image body', async () => {
    nonImageClosed = new Promise<void>(resolve => {
      resolveNonImageClosed = resolve;
    });

    await expect(fetchHttpImage(nonImageUrl)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('not an image: text/html; charset=utf-8')
    });
    await expect(closesWithin(nonImageClosed, 1000)).resolves.toBe(true);
  });

  it('closes a streaming non-2xx body', async () => {
    slowErrorClosed = new Promise<void>(resolve => {
      resolveSlowErrorClosed = resolve;
    });

    await expect(fetchHttpImage(slowErrorUrl)).rejects.toMatchObject({ status: 504 });
    await expect(closesWithin(slowErrorClosed, 1000)).resolves.toBe(true);
  });

  it('accepts a valid image media type regardless of case', async () => {
    await expect(fetchHttpImage(mixedCaseUrl)).resolves.toEqual(BODY);
  });

  it('returns a body that declares no media type at all', async () => {
    await expect(fetchHttpImage(undeclaredUrl)).resolves.toEqual(BODY);
  });

  it.each([
    ['an image media type', () => emptyUrl],
    ['no media type at all', () => emptyUndeclaredUrl]
  ])('raises a routine miss on a zero-length body declaring %s', async (_name, target) => {
    await expect(fetchHttpImage(target())).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('empty body')
    });
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
