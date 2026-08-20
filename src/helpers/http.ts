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

export async function readHttpImage(url: string, response: Response): Promise<Buffer> {
  if (!response.ok) {
    await response.body?.cancel();
    throw httpError(new URL(url).host, response.status, response.statusText);
  }

  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('image/')) {
    await response.body?.cancel();
    throw httpError(new URL(url).host, 404, `not an image: ${type}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return withDeadline(
    async signal => readHttpImage(url, await fetch(url, { signal })),
    IMAGE_FETCH_BUDGET
  );
}

export function getUrl(url) {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  return snapshot.utils.getUrl(url, gateway);
}
