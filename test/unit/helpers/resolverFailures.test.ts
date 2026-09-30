import http from 'http';
import { AddressInfo } from 'net';
import { recordResolverFailures } from '../../helpers/resolverFailures';

jest.retryTimes(1);

const failures = recordResolverFailures();
const server = http.createServer((_req, res) => {
  setTimeout(() => {
    res.statusCode = 500;
    res.end();
  }, 700);
});
let url: string;
let attempt = 0;

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

describe('recordResolverFailures', () => {
  it.concurrent(
    'does not blame a retry for a failure of the attempt that timed out',
    async () => {
      if (++attempt === 1) {
        await fetch(url);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 400));
      expect(failures()).toEqual([]);
    },
    500
  );
});
