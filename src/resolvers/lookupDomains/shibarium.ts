import constants from '../../constants.json';
import { withDeadline } from '../../helpers/deadline';
import { httpError } from '../../helpers/errors';
import { Address, Handle } from '../../helpers/types';

const MAINNET = '109';
const TESTNET = '157';
const PAGE_SIZE = 25;

const D3: Record<string, { apiUrl: string; forwarder: string }> = constants.d3;

const API_KEYS: Record<string, string | undefined> = {
  [MAINNET]: process.env.D3_API_KEY_MAINNET,
  [TESTNET]: process.env.D3_API_KEY_TESTNET
};

export const NAME = 'Shibarium';
export const DEFAULT_CHAIN_ID = MAINNET;
export const CHAIN_IDS = Object.keys(constants.d3);

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  const apiKey = API_KEYS[chainId];
  if (!D3[chainId]?.apiUrl || !apiKey) return [];

  return withDeadline(async signal => {
    const allDomains: Handle[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${D3[chainId].apiUrl}/v1/partner/tokens/EVM/${address}?limit=${PAGE_SIZE}&skip=${skip}`,
        {
          headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
          signal
        }
      );

      if (response.status === 404) {
        break;
      }

      if (!response.ok) {
        throw httpError(
          'shibarium',
          response.status,
          `status code ${response.status}: ${response.statusText}`
        );
      }

      let data: { pageItems?: Array<{ sld: string; tld: string }> };
      try {
        data = await response.json();
      } catch (err) {
        throw Object.assign(new Error(`Invalid JSON response: ${(err as any).message}`), {
          cause: err
        });
      }

      const domains = data.pageItems?.map(item => `${item.sld}.${item.tld}`) || [];
      allDomains.push(...domains);

      hasMore = domains.length === PAGE_SIZE;
      skip += PAGE_SIZE;
    }

    return allDomains;
  });
}
