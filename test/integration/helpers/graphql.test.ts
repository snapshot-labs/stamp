import http from 'http';
import { AddressInfo, Socket } from 'net';
import { graphQlCall } from '../../../src/helpers/graphql';

const QUERY = 'query users { users { id } }';
const PAYLOAD = { data: { users: [{ id: '0x1' }] } };

let server: http.Server;
let url: string;
const sockets = new Set<Socket>();

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(PAYLOAD));
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`;
});

afterAll(async () => {
  sockets.forEach(socket => socket.destroy());
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('graphQlCall, against a real upstream', () => {
  it('reads the body before the deadline releases the request', async () => {
    await expect(graphQlCall(url, QUERY)).resolves.toEqual(PAYLOAD);
  });
});
