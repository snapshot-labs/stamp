import http from 'http';
import https from 'https';
import { getAddress } from '@ethersproject/address';
import axios from 'axios';
import { isStarknetAddress } from './address';

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

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return (
    await axios({
      url,
      ...{
        responseType: 'arraybuffer',
        ...axiosDefaultParams
      }
    })
  ).data;
}
