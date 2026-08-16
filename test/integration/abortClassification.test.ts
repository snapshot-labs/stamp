import http from 'http';
import nodeFetch from 'node-fetch';
import { isSilencedError } from '../../src/helpers/address';

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

async function abortAgainstAHangingServer(request: (u: string, init: any) => Promise<unknown>) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);

  try {
    await request(url, { signal: controller.signal });
  } catch (err: any) {
    return err;
  }

  return undefined;
}

describe('isSilencedError, on a request we aborted ourselves', () => {
  it('silences an abort raised by node-fetch', async () => {
    const error = await abortAgainstAHangingServer(nodeFetch as any);

    expect(error).toBeDefined();
    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });

  it('silences an abort raised by the global fetch', async () => {
    const error = await abortAgainstAHangingServer(fetch as any);

    expect(error).toBeDefined();
    expect(error.name).toBe('AbortError');
    expect(isSilencedError(error)).toBe(true);
  });

  it('matches on the name because the two transports word the message differently', async () => {
    const viaNodeFetch = await abortAgainstAHangingServer(nodeFetch as any);
    const viaGlobalFetch = await abortAgainstAHangingServer(fetch as any);

    expect(viaNodeFetch.message).not.toEqual(viaGlobalFetch.message);
    expect(viaNodeFetch.name).toBe(viaGlobalFetch.name);
  });
});
