import { configureToMatchImageSnapshot } from 'jest-image-snapshot';
import client, { closeRedis } from '../src/helpers/redis';

// Allow a tiny percentage of differing pixels to absorb anti-aliasing noise
// across platforms / sharp versions. The matcher fails above this threshold.
const toMatchImageSnapshot = configureToMatchImageSnapshot({
  failureThreshold: 0.01,
  failureThresholdType: 'percent'
});

expect.extend({ toMatchImageSnapshot });

jest.spyOn(console, 'log').mockImplementation(() => {});

jest.retryTimes(3);

afterAll(async () => {
  if (client?.isReady) await client.flushDb().catch(() => undefined);
  await closeRedis();
});
