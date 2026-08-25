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

export function fetchWithDeadline<T>(
  url: string,
  read: (response: Response) => Promise<T>
): Promise<T> {
  return withDeadline(async signal => {
    const response = await fetch(url, { signal });

    if (!response.ok) throw httpError(new URL(url).host, response.status, response.statusText);

    return read(response);
  }, 5e3);
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function readBoundedImage(url: string, response: Response): Promise<Buffer> {
  const host = new URL(url).host;
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

export function fetchHttpImage(url: string): Promise<Buffer> {
  return fetchWithDeadline(url, response => readBoundedImage(url, response));
}

export function getUrl(url: string): string | null {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  const candidate = snapshot.utils.getUrl(url, gateway);
  if (!candidate) return null;

  try {
    return ['http:', 'https:'].includes(new URL(candidate).protocol) ? candidate : null;
  } catch {
    return null;
  }
}
