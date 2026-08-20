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

  it('flushes and gracefully quits a ready client', async () => {
    const client = mockClient();

    await closeRedis(client);

    expect(client.flushDb).toHaveBeenCalledTimes(1);
    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when graceful cleanup fails', async () => {
    const client = mockClient({
      flushDb: jest.fn().mockRejectedValue(new Error('Redis unavailable'))
    });

    await closeRedis(client);

    expect(client.quit).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});
