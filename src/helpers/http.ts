import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { isStarknetAddress } from './address';
import { withDeadline, withInactivityTimeout } from './deadline';
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

const IMAGE_FETCH_BUDGET = 5e3;

export async function fetchHttpResponse(
  url: string,
  init: RequestInit = {},
  inactivityBudget = IMAGE_FETCH_BUDGET
): Promise<{ response: Response; body: Buffer }> {
  return withInactivityTimeout(async (signal, activity) => {
    const response = await fetch(url, { ...init, signal });
    activity();

    const reader = response.body?.getReader();
    if (!reader) return { response, body: Buffer.alloc(0) };

    const chunks: Buffer[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      activity();
      chunks.push(Buffer.from(value));
    }

    return { response, body: Buffer.concat(chunks) };
  }, inactivityBudget);
}

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return withDeadline(async signal => {
    const response = await fetch(url, { signal });

    if (!response.ok) throw httpError(new URL(url).host, response.status, response.statusText);

    return Buffer.from(await response.arrayBuffer());
  }, IMAGE_FETCH_BUDGET);
}

export function getUrl(url) {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  return snapshot.utils.getUrl(url, gateway);
}
