import { Readable } from 'stream';
import { capture } from '@snapshot-labs/snapshot-sentry';
import sharp from 'sharp';
import { get, set } from '../../../../src/aws';
import cache from '../../../../src/resolvers/image/cache';
import { parseQuery } from '../../../../src/resolvers/image/query';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../../../src/aws', () => ({
  ...jest.requireActual('../../../../src/aws'),
  get: jest.fn(),
  set: jest.fn()
}));

const QUERY = parseQuery('0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc', 'avatar', { s: '32' });

let image: Buffer;
let callback: jest.Mock;

function flushWrites() {
  return new Promise(resolve => setImmediate(resolve));
}

beforeAll(async () => {
  image = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } })
    .png()
    .toBuffer();
});

beforeEach(() => {
  (get as jest.Mock).mockReset().mockResolvedValue(false);
  (set as jest.Mock).mockReset().mockResolvedValue(undefined);
  callback = jest.fn().mockResolvedValue(image);
});

describe('image cache', () => {
  it('returns the resized-cache stream without buffering or resolving', async () => {
    const stream = Readable.from([Buffer.from('cached')]);
    (get as jest.Mock).mockResolvedValueOnce(stream);

    expect(await cache('avatar', QUERY, callback)).toBe(stream);
    expect(callback).not.toHaveBeenCalled();
    const [[key]] = (get as jest.Mock).mock.calls;
    const [key1] = key.split('/');
    expect(key).toMatch(new RegExp(`^${key1}/(?!${key1}$)`));
  });

  it('resizes the base-cache image and stores only the resized level', async () => {
    (get as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(Readable.from([image]));

    const result = await cache('avatar', QUERY, callback);
    await flushWrites();

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.any(String), result);
  });

  it('stores the base then the resized level on a miss', async () => {
    const result = await cache('avatar', QUERY, callback);
    await flushWrites();

    const [[baseKey, base], [resizedKey, resized]] = (set as jest.Mock).mock.calls;
    const [key1] = baseKey.split('/');
    expect(baseKey).toBe(`${key1}/${key1}`);
    expect(base).toBe(image);
    expect(resizedKey).toMatch(new RegExp(`^${key1}/(?!${key1}$)`));
    expect(resized).toBe(result);
  });

  it('returns false and stores nothing when the callback finds no image', async () => {
    callback.mockResolvedValue(false);

    expect(await cache('avatar', QUERY, callback)).toBe(false);
    await flushWrites();
    expect(set).not.toHaveBeenCalled();
  });

  it('skips the resized cache and stores nothing when bypassed', async () => {
    (get as jest.Mock).mockResolvedValueOnce(Readable.from([Buffer.from('cached')]));

    const result = await cache('avatar', QUERY, callback, true);
    await flushWrites();

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });

  it('does not wait for the cache writes', async () => {
    (set as jest.Mock).mockReturnValue(new Promise(() => {}));
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('waited on the cache write')), 1000)
    );

    expect(Buffer.isBuffer(await Promise.race([cache('avatar', QUERY, callback), timeout]))).toBe(
      true
    );
  });

  it('captures a failed write without failing the lookup', async () => {
    (set as jest.Mock).mockRejectedValue(new Error('s3 down'));

    expect(Buffer.isBuffer(await cache('avatar', QUERY, callback))).toBe(true);
    await flushWrites();
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ message: 's3 down' }));
  });
});
