import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | undefined;
let connection: Promise<void> | undefined;

(() => {
  if (!process.env.REDIS_URL) return;

  console.log('[redis] Connecting to Redis');
  client = createClient({
    url: process.env.REDIS_URL,
    socket: process.env.NODE_ENV === 'test' ? { reconnectStrategy: false } : undefined
  });
  client.on('connect', () => console.log('[redis] Redis connect'));
  client.on('ready', () => console.log('[redis] Redis ready'));
  client.on('reconnecting', err => console.log('[redis] Redis reconnecting', err));
  client.on('error', err => console.log('[redis] Redis error', err));
  client.on('end', () => console.log('[redis] Redis end'));
  connection = client
    .connect()
    .then(() => undefined)
    .catch(() => undefined);
})();

export default client;

export async function closeRedis(redisClient = client): Promise<void> {
  if (!redisClient) return;

  if (redisClient.isReady) {
    try {
      await redisClient.flushDb();
      await redisClient.quit();
      return;
    } catch {
      // Fall through to a forced disconnect if graceful cleanup fails.
    }
  }

  if (redisClient.isOpen) await redisClient.disconnect();
  if (redisClient === client) await connection;
}
