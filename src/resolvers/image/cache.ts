import { Readable } from 'stream';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { clear as clearStore, get, set, streamToBuffer } from '../../aws';
import { getBaseCacheKey, getCacheKey, parseQuery } from '../../helpers/api';
import { resize } from '../../helpers/image';
import { ResolverType } from '../../helpers/types';

type Query = ReturnType<typeof parseQuery>;

async function store(
  key1: string,
  key2: string,
  address: string,
  baseImage: Buffer | undefined,
  resizedImage: Buffer
) {
  try {
    if (baseImage) {
      await set(`${key1}/${key1}`, baseImage);
      console.log('Stored base cache', key1);
    }
    await set(`${key1}/${key2}`, resizedImage);
    console.log('Stored cache', address);
  } catch (err) {
    capture(err);
    console.log('Store cache failed', address, err);
  }
}

export default async function cache(
  type: ResolverType,
  query: Query,
  callback: () => Promise<Buffer | false>,
  bypass = false
): Promise<Buffer | Readable | false> {
  const { network, address, w, h, fallback, cb, fit } = query;
  const key1 = getBaseCacheKey(type, query);
  const key2 = getCacheKey({ type, network, address, w, h, fallback, cb, fit });

  // Check resized cache
  const cached = await get(`${key1}/${key2}`);
  if (cached && !bypass) return cached;

  // Check base cache
  const base = await get(`${key1}/${key1}`);
  const baseImage = base ? ((await streamToBuffer(base)) as Buffer) : await callback();
  if (!baseImage) return false;

  const resizedImage = await resize(baseImage, w, h, { fit });

  // Not awaited so the response does not wait on S3; store() captures its own failures.
  if (!bypass) store(key1, key2, address, base ? undefined : baseImage, resizedImage);

  return resizedImage;
}

export function clear(type: ResolverType, query: Query) {
  return clearStore(getBaseCacheKey(type, query));
}
