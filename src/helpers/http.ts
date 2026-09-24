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

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// A data: URL's payload is decoded inside fetch() itself, synchronously, before
// withDeadline's abort can run, so this bounds the decode instead of reusing
// MAX_IMAGE_BYTES, which bounds the unrelated decoded-image-size budget.
export const MAX_URL_BYTES = 1024 * 1024;

function fetchBounded(url: string, signal: AbortSignal): Promise<Response> {
  if (Buffer.byteLength(url) > MAX_URL_BYTES) {
    throw httpError('url', 404, `url too large: over ${MAX_URL_BYTES} bytes`);
  }

  return fetch(url, { signal });
}

async function readHttpImage(response: Response): Promise<Buffer> {
  const host = new URL(response.url).host;

  if (!response.ok) {
    await response.body?.cancel();
    // No credentials are sent and nothing here retries, so any non-2xx is this
    // host not serving this image, including the 401/402/403 that isRoutineMiss
    // keeps loud for authenticated API calls.
    throw httpError(host, 404, response.statusText);
  }

  const type = response.headers.get('content-type');
  if (type && !type.toLowerCase().startsWith('image/')) {
    await response.body?.cancel();
    throw httpError(host, 404, `not an image: ${type}`);
  }

  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw httpError(host, 404, `image too large: ${declared} bytes`);
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw httpError(host, 404, 'empty body');
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) {
      throw httpError(host, 404, `image too large: over ${MAX_IMAGE_BYTES} bytes`);
    }

    chunks.push(chunk);
  }

  if (total === 0) throw httpError(host, 404, 'empty body');

  return Buffer.concat(chunks);
}

export async function fetchHttpImage(
  url: string,
  follow?: (response: Response) => Promise<string | undefined>
): Promise<Buffer> {
  return withDeadline(async signal => {
    const response = await fetchBounded(url, signal);
    const next = await follow?.(response);

    return readHttpImage(next ? await fetchBounded(next, signal) : response);
  }, 5e3);
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
  if (url.startsWith('data:')) return url;

  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  const candidate = snapshot.utils.getUrl(url, gateway);
  if (!candidate) return null;

  return isHttpUrl(candidate) ? candidate : null;
}
