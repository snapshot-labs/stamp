// eslint-disable-next-line @typescript-eslint/no-empty-function
jest.spyOn(console, 'log').mockImplementation(() => {});

jest.retryTimes(3);

import client from '../src/helpers/redis';

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
