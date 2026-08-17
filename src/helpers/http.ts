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

const IMAGE_FETCH_BUDGET = 5e3;

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return withDeadline(async signal => {
    const response = await fetch(url, { signal });

    if (!response.ok) throw httpError(new URL(url).host, response.status, response.statusText);

    return Buffer.from(await response.arrayBuffer());
  }, IMAGE_FETCH_BUDGET);
}
