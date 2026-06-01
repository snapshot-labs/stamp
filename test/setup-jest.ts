// Silence noisy console output from libraries (e.g. @webinterop/dns-connect) during tests
// eslint-disable-next-line @typescript-eslint/no-empty-function
const silence = () => {};
jest.spyOn(console, 'log').mockImplementation(silence);
jest.spyOn(console, 'info').mockImplementation(silence);
jest.spyOn(console, 'warn').mockImplementation(silence);
jest.spyOn(console, 'error').mockImplementation(silence);
jest.spyOn(console, 'debug').mockImplementation(silence);

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
