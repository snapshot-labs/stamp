import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { isStarknetAddress } from './address';
import { FETCH_BUDGET, withDeadline } from './deadline';
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

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return withDeadline(async signal => {
    const response = await fetch(url, { signal });

    if (!response.ok) throw httpError(new URL(url).host, response.status, response.statusText);

    return Buffer.from(await response.arrayBuffer());
  }, FETCH_BUDGET);
}

export function getUrl(url) {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  return snapshot.utils.getUrl(url, gateway);
}
