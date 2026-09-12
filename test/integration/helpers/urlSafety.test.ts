import http from 'http';
import { AddressInfo, Socket } from 'net';
import os from 'os';
import { fetchHttpImage, isPublicAddress } from '../../../src/helpers/http';

let server: http.Server;
let port: number;
let requests: number;
let internalRequests: number;
const sockets = new Set<Socket>();

function findPublicInterfaceAddress(): string | null {
  const interfaces = Object.values(os.networkInterfaces()).flat();

  return (
    interfaces.find(
      entry => entry?.family === 'IPv4' && !entry.internal && isPublicAddress(entry.address)
    )?.address ?? null
  );
}

const publicAddress = findPublicInterfaceAddress();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/redirect-to-internal') {
      res.writeHead(302, { Location: `http://127.0.0.1:${port}/internal` });
      return res.end();
    }

    if (req.url === '/internal') {
      internalRequests += 1;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('internal data');
    }

    requests += 1;
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(Buffer.from('image bytes'));
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '0.0.0.0', () => resolve()));
  port = (server.address() as AddressInfo).port;
});

beforeEach(() => {
  requests = 0;
  internalRequests = 0;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('fetchHttpImage, with the default (guarded) dispatcher', () => {
  it('rejects a scheme other than http/https before ever touching the network', async () => {
    await expect(fetchHttpImage('ftp://example.com/x.png')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects the cloud instance-metadata address on sight', async () => {
    await expect(fetchHttpImage('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject({
      status: 400
    });
  });

  it('rejects a literal loopback address instead of reaching the server listening there', async () => {
    await expect(fetchHttpImage(`http://127.0.0.1:${port}/image.png`)).rejects.toMatchObject({
      status: 400
    });
    expect(requests).toBe(0);
  });

  it('rejects a hostname that resolves to loopback, not only a bare loopback literal', async () => {
    await expect(fetchHttpImage(`http://localhost:${port}/image.png`)).rejects.toMatchObject({
      status: 400
    });
    expect(requests).toBe(0);
  });

  const itFromAPublicInterface = publicAddress ? it : it.skip;

  itFromAPublicInterface(
    'rejects a redirect from a public address to a blocked one, without returning the redirected body',
    async () => {
      await expect(
        fetchHttpImage(`http://${publicAddress}:${port}/redirect-to-internal`)
      ).rejects.toMatchObject({ status: 400 });
      expect(internalRequests).toBe(0);
    }
  );
});
