import { execFile } from 'child_process';
import path from 'path';
import { RedisClientType } from 'redis';
import { closeRedis } from '../../../src/helpers/redis';

function mockClient(overrides: Partial<RedisClientType> = {}) {
  return {
    isOpen: true,
    isReady: true,
    flushDb: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as RedisClientType;
}

describe('closeRedis', () => {
  it('disconnects a client that never became ready', async () => {
    const client = mockClient({ isReady: false });

    await closeRedis(client);

    expect(client.flushDb).not.toHaveBeenCalled();
    expect(client.quit).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('gracefully quits a ready client without touching its data', async () => {
    const client = mockClient();

    await closeRedis(client);

    expect(client.flushDb).not.toHaveBeenCalled();
    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when graceful cleanup fails', async () => {
    const client = mockClient({
      quit: jest.fn().mockRejectedValue(new Error('Redis unavailable'))
    });

    await closeRedis(client);

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('lets the process exit on its own against an unreachable Redis endpoint', async () => {
    const script = path.join(__dirname, 'fixtures/close-redis-unreachable.ts');

    await new Promise<void>((resolve, reject) => {
      execFile(
        process.execPath,
        ['-r', 'ts-node/register/transpile-only', script],
        {
          env: {
            ...process.env,
            REDIS_URL: 'redis://127.0.0.1:1',
            NODE_ENV: 'test'
          },
          timeout: 10000
        },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(`${error.message}\n${stdout}\n${stderr}`));
          resolve();
        }
      );
    });
  }, 15000);
});
