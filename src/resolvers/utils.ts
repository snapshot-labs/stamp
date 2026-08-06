import http from 'http';
import https from 'https';
import { getAddress } from '@ethersproject/address';
import axios from 'axios';
import { isStarknetAddress } from '../addressResolvers/utils';

export const axiosDefaultParams = {
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 5e3
};

// axios' message for an HTTP 404. Resolvers whose no-data answer IS a 404 pass
// this to index.ts as a muted error.
export const HTTP_404_ERROR = 'Request failed with status code 404';

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

// An id that is not an EVM address is not an address the upstreams know about:
// that is no data (null), not an error, so it must not reach index.ts as a
// rejection.
export function toChecksumAddress(address: string): string | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

// The ids to query an onchain space by. The id arrives lowercased from the
// request while the API stores EVM ids checksummed, so both spellings are
// queried.
export function spaceIds(id: string): string[] | null {
  if (isStarknetAddress(id)) return [id];

  const checksum = toChecksumAddress(id);

  return checksum ? [id, checksum] : null;
}
