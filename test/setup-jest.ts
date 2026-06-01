// eslint-disable-next-line @typescript-eslint/no-empty-function
jest.spyOn(console, 'log').mockImplementation(() => {});

jest.retryTimes(3);

import client from '../src/helpers/redis';

beforeAll(async () => {
  // Wait for the redis singleton to finish connecting so its connect/ready logs
  // fire during this (mocked) window instead of after the suite ends, which Jest
  // would otherwise flag as "Cannot log after tests are done".
  if (client) {
    try {
      await client.ping();
    } catch (error) {
      // Ignore connection errors during setup
    }
  }
});

afterAll(async () => {
  if (client) {
    try {
      await client.flushDb();
      await client.quit();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
});
