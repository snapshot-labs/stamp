import { Readable } from 'stream';
import * as AWS from '@aws-sdk/client-s3';

let client;
const bucket = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_REGION;
const endpoint = process.env.AWS_ENDPOINT || undefined;
if (region) client = new AWS.S3({ region, endpoint });
const dir = 'stamp-7';

export async function streamToBuffer(stream: Readable) {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function set(key, value) {
  if (!client) throw new Error('AWS cache not initialized');

  try {
    const command = new AWS.PutObjectCommand({
      Bucket: bucket,
      Key: `public/${dir}/${key}`,
      Body: value,
      ContentType: 'image/webp'
    });

    await client.send(command);
  } catch (err) {
    console.log('Store cache failed', err);
    throw err;
  }
}

export async function clear(path) {
  if (!client) throw new Error('AWS cache not initialized');

  try {
    const listedObjects = await client.listObjectsV2({
      Bucket: bucket,
      Prefix: `public/${dir}/${path}`
    });
    if (!listedObjects.Contents || listedObjects.Contents.length === 0) return false;
    const objs = listedObjects.Contents.map(obj => ({ Key: obj.Key }));
    await client.deleteObjects({
      Bucket: bucket,
      Delete: { Objects: objs }
    });
    if (listedObjects.IsTruncated) await clear(path);
    console.log('Cleared cache', path);
    return path;
  } catch (err) {
    console.log('Clear cache failed', err);
    throw err;
  }
}

export async function get(key) {
  try {
    const command = new AWS.GetObjectCommand({
      Bucket: bucket,
      Key: `public/${dir}/${key}`
    });

    const { Body } = await client.send(command);

    return Body;
  } catch {
    return false;
  }
}
