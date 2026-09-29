import { EventEmitter, once } from 'events';
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
let mockRedis:
  | {
      default?: EventEmitter & {
        isOpen: boolean;
        isReady: boolean;
        flushDb(): Promise<unknown>;
        destroy(): void;
      };
    }
  | undefined;
jest.mock('../src/helpers/redis', () => (mockRedis = jest.requireActual('../src/helpers/redis')));

afterAll(async () => {
  const client = mockRedis?.default;
  if (!client?.isOpen) return;

  // destroy() during a connection attempt misses the socket being opened, which then
  // connects anyway and keeps Jest alive; let the attempt succeed or fail first.
  if (!client.isReady) await once(client, 'ready').catch(() => {});

  try {
    if (client.isReady) await client.flushDb();
  } finally {
    client.destroy();
  }
});
