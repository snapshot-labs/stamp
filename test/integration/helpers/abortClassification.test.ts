import http from 'http';
import { isSilencedError } from '../../../src/helpers/errors';

let server: http.Server;
let url: string;
const sockets = new Set<any>();

beforeAll(async () => {
  server = http.createServer(() => {
    // Accepts the connection and never answers, so the abort is what ends the request.
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as any).port}/`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function abortAgainstAHangingServer() {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);

  try {
    await fetch(url, { signal: controller.signal });
  } catch (err: any) {
    return err;
  }

  return undefined;
}

describe('isSilencedError, on a request we aborted ourselves', () => {
  it('silences an abort raised by fetch', async () => {
    const error = await abortAgainstAHangingServer();

    expect(error).toBeDefined();
    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });
});
