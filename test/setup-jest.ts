import { once } from 'events';
import { configureToMatchImageSnapshot } from 'jest-image-snapshot';

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: { threshold: 0.1 },
  failureThreshold: 0.001,
  failureThresholdType: 'percent'
});

expect.extend({ toMatchImageSnapshot });

jest.spyOn(console, 'log').mockImplementation(() => {});

jest.retryTimes(3);

// No client unless a file opts in with jest.unmock(), so only files that use redis connect to it.
jest.mock('../src/helpers/redis', () => ({ __esModule: true, default: undefined }));

afterAll(async () => {
  // Imported here, not at the top: resolves to the module this file got, real or no client.
  const { default: client } = await import('../src/helpers/redis');
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
