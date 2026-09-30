import path from 'path';
import dotenv from 'dotenv';

// Load .env file from root
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

// Load .env.test file from test directory (overwrites any duplicate keys)
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true, quiet: true });

// One redis DB per worker: sharing one lets a parallel file flush another's seeded keys,
// and DB 0 is the developer's own data.
const redisDb = Number(process.env.JEST_WORKER_ID);
if (redisDb > 15)
  throw new Error(`Jest worker ${redisDb} has no redis DB left (1-15); lower --maxWorkers`);
const redisUrl = new URL(process.env.REDIS_URL as string);
redisUrl.pathname = `/${redisDb}`;
process.env.REDIS_URL = redisUrl.toString();
