import { configureToMatchImageSnapshot } from 'jest-image-snapshot';
import client from '../src/helpers/redis';

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: { threshold: 0.1 },
  failureThreshold: 0.001,
  failureThresholdType: 'percent'
});

expect.extend({ toMatchImageSnapshot });

jest.spyOn(console, 'log').mockImplementation(() => {});

jest.retryTimes(3);

afterAll(async () => {
  if (client) {
    try {
      await client.flushDb();
      await client.close();
    } catch {
      // Ignore errors during cleanup
    }
  }
});
