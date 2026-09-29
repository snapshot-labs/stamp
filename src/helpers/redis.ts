import { createClient, RedisClientType } from 'redis';

type NoExtensions = Record<never, never>;

let client: RedisClientType<NoExtensions, NoExtensions, NoExtensions, 2> | undefined;

(async () => {
  if (!process.env.REDIS_URL) return;

  console.log('[redis] Connecting to Redis');
  client = createClient({
    url: process.env.REDIS_URL,
    RESP: 2,
    socket: { keepAliveInitialDelay: 5000 },
    commandOptions: { timeout: undefined }
  });
  client.on('connect', () => console.log('[redis] Redis connect'));
  client.on('ready', () => console.log('[redis] Redis ready'));
  client.on('reconnecting', err => console.log('[redis] Redis reconnecting', err));
  client.on('error', err => console.log('[redis] Redis error', err));
  client.on('end', () => console.log('[redis] Redis end'));
  await client.connect();
})();

export default client;
