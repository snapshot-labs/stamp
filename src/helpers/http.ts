import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { isStarknetAddress } from './address';
import { withDeadline } from './deadline';
import { httpError } from './errors';

// Spaces are keyed by address on the onchain APIs, and both accept the raw id
// as well as the checksummed one. An id that is not an address is not a space
// there, so it is no-data rather than something to ask about.
export function spaceIds(id: string): string[] | null {
  if (isStarknetAddress(id)) return [id];

  try {
    return [id, getAddress(id)];
  } catch {
    return null;
  }
}

export const IMAGE_FETCH_BUDGET = 5e3;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function readHttpImage(url: string, response: Response): Promise<Buffer> {
  const host = new URL(url).host;

  if (!response.ok) {
    await response.body?.cancel();
    throw httpError(host, response.status, response.statusText);
  }

  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('image/')) {
    await response.body?.cancel();
    throw httpError(host, 404, `not an image: ${type}`);
  }

  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw httpError(host, 404, `image too large: ${declared} bytes`);
  }

  if (!response.body) return Buffer.from(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) {
      throw httpError(host, 404, `image too large: over ${MAX_IMAGE_BYTES} bytes`);
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return withDeadline(
    async signal => readHttpImage(url, await fetch(url, { signal })),
    IMAGE_FETCH_BUDGET
  );
}

export function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
}

export function getUrl(url: string): string | null {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  const candidate = snapshot.utils.getUrl(url, gateway);
  if (!candidate) return null;

  return isHttpUrl(candidate) ? candidate : null;
}
