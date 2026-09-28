import { configureToMatchImageSnapshot } from 'jest-image-snapshot';
import client from '../src/helpers/redis';

// The per-pixel colour threshold absorbs resampling/re-encode noise across
// platforms and libvips versions; the library default (0.01) counts those
// invisible deltas as differing pixels. failureThreshold is a 0-1 ratio, not a
// percentage: fail when more than 0.1% of pixels differ.
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
      await client.quit();
    } catch {
      // Ignore errors during cleanup
    }
  }
});
