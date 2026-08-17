import http from 'http';
import https from 'https';
import { getAddress } from '@ethersproject/address';
import { isStarknetAddress } from './address';
import { httpError, withDeadline } from '../utils';

export const axiosDefaultParams = {
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 5e3
};

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

// Shorter than the shared budget because this covers a single transfer, where
// the other call sites cover a chain of them.
const IMAGE_FETCH_BUDGET = 5e3;

// The budget covers the whole call, not just the request: fetch settles as soon
// as the headers land, so a body that opens and never ends outlives a budget
// measured per request. Redirects and the body read are inside it too.
export async function fetchHttpImage(url: string): Promise<Buffer> {
  return withDeadline(async signal => {
    const response = await fetch(url, { signal });

    // fetch resolves a non-2xx, and the resolvers that skip the resize hand what
    // they get straight to the encoder.
    if (!response.ok) throw httpError(new URL(url).host, response.status, response.statusText);

    return Buffer.from(await response.arrayBuffer());
  }, IMAGE_FETCH_BUDGET);
}
