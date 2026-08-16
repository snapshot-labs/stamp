import fetch from 'node-fetch';
import constants from '../../constants.json';
import { Address, Handle, withDeadline } from '../../utils';

const MAINNET = '109';
const TESTNET = '157';
const PAGE_SIZE = 25;

const API_KEYS = {
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
  if (!constants.d3[chainId]?.apiUrl || !API_KEYS[chainId]) return [];

  return withDeadline(async signal => {
    const allDomains: Handle[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${constants.d3[chainId].apiUrl}/v1/partner/tokens/EVM/${address}?limit=${PAGE_SIZE}&skip=${skip}`,
        {
          headers: { 'Content-Type': 'application/json', 'Api-Key': API_KEYS[chainId] },
          signal
        }
      );

      if (response.status === 404) {
        break;
      }

      if (!response.ok) {
        throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
          status: response.status
        });
      }

      let data: { pageItems?: Array<{ sld: string; tld: string }> };
      try {
        data = await response.json();
      } catch (err) {
        throw new Error(`Invalid JSON response: ${(err as any).message}`);
      }

      const domains = data.pageItems?.map(item => `${item.sld}.${item.tld}`) || [];
      allDomains.push(...domains);

      hasMore = domains.length === PAGE_SIZE;
      skip += PAGE_SIZE;
    }

    return allDomains;
  });
}
