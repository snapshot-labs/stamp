import { configureToMatchImageSnapshot } from 'jest-image-snapshot';

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: { threshold: 0.1 },
  failureThreshold: 0.001,
  failureThresholdType: 'percent'
});

expect.extend({ toMatchImageSnapshot });

jest.spyOn(console, 'log').mockImplementation(() => {});

jest.retryTimes(3);

// Lazy so only files that load redis connect; importing it here would connect in every file.
let mockRedis: { default?: { flushDb(): Promise<unknown>; close(): Promise<unknown> } } | undefined;
jest.mock('../src/helpers/redis', () => (mockRedis = jest.requireActual('../src/helpers/redis')));

afterAll(async () => {
  const client = mockRedis?.default;
  if (client) {
    try {
      await client.flushDb();
      await client.close();
    } catch {
      // Ignore errors during cleanup
    }
  }
});
