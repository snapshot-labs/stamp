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

export function fetchHttpImage(url: string): Promise<Buffer> {
  return fetchWithDeadline(url, async response => Buffer.from(await response.arrayBuffer()));
}

export function getUrl(url) {
  if (url.startsWith('data:')) return url;

  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  return snapshot.utils.getUrl(url, gateway);
}
