import http from 'http';
import { AddressInfo, Socket } from 'net';
import { isSilencedError } from '../../../src/helpers/errors';
import { fetchHttpImage, MAX_IMAGE_BYTES } from '../../../src/helpers/http';

const BODY = Buffer.from('as much of an image as the fetch cares about');
const CHUNK = Buffer.alloc(1024 * 1024, 'x');

let server: http.Server;
let url: string;
let missingUrl: string;
let nonImageUrl: string;
let mixedCaseUrl: string;
let neverEndingUrl: string;
let oversizedDeclaredUrl: string;
let oversizedStreamedUrl: string;
let slowErrorUrl: string;
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
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>(resolve => {
    timer = setTimeout(() => resolve(false), ms);
  });
  const closed = await Promise.race([promise.then(() => true), timeout]);
  if (timer) clearTimeout(timer);
  return closed;
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

    if (req.url === '/slow-error.png') {
      res.writeHead(504, { 'Content-Type': 'text/html' });
      return streamForever(res, resolveSlowErrorClosed);
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
  oversizedDeclaredUrl = `${origin}/oversized-declared.png`;
  oversizedStreamedUrl = `${origin}/oversized-streamed.png`;
  slowErrorUrl = `${origin}/slow-error.png`;
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
    const nativeFetch = global.fetch;
    let response: Response | undefined;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      response = await nativeFetch(input, init);
      return response;
    });

    try {
      await expect(fetchHttpImage(nonImageUrl)).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('not an image: text/html; charset=utf-8')
      });
      await expect(closesWithin(nonImageClosed, 1000)).resolves.toBe(true);
    } finally {
      fetchSpy.mockRestore();
      await response?.body?.cancel();
    }
  });

  it('closes a streaming non-2xx body', async () => {
    slowErrorClosed = new Promise<void>(resolve => {
      resolveSlowErrorClosed = resolve;
    });
    const nativeFetch = global.fetch;
    let response: Response | undefined;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      response = await nativeFetch(input, init);
      return response;
    });

    try {
      await expect(fetchHttpImage(slowErrorUrl)).rejects.toMatchObject({ status: 504 });
      await expect(closesWithin(slowErrorClosed, 1000)).resolves.toBe(true);
    } finally {
      fetchSpy.mockRestore();
      await response?.body?.cancel();
    }
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
