import http from 'http';
import { AddressInfo } from 'net';
import { recordResolverFailures } from '../../helpers/resolverFailures';

jest.retryTimes(1);

const withFailures = recordResolverFailures();
const server = http.createServer((req, res) => {
  setTimeout(
    () => {
      res.statusCode = req.url === '/answers' ? 200 : 500;
      res.end();
    },
    req.url === '/fails-now' ? 0 : 700
  );
});
let url: string;
const attempts = { late: 0, followUp: 0 };

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

describe('recordResolverFailures, when a retry follows an attempt that timed out', () => {
  it.concurrent(
    'does not blame the retry for a late failure of the attempt that timed out',
    withFailures(async failures => {
      if (++attempts.late === 1) {
        await fetch(`${url}/fails`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 400));
      expect(failures).toEqual([]);
    }),
    500
  );
});

// A describe of its own: retries wait for their block's other tests, and this retry must
// already be running when the timed-out attempt makes its next call.
describe('recordResolverFailures, when a timed-out attempt keeps calling', () => {
  it.concurrent(
    'does not blame the retry for its calls',
    withFailures(async failures => {
      if (++attempts.followUp === 1) {
        await fetch(`${url}/answers`);
        await fetch(`${url}/fails-now`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 400));
      expect(failures).toEqual([]);
    }),
    500
  );
});
