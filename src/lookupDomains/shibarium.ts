import { capture } from '@snapshot-labs/snapshot-sentry';
import fetch from 'node-fetch';
import constants from '../constants.json';
import { Address, Handle } from '../utils';

const MAINNET = '109';
const TESTNET = '157';
const PAGE_SIZE = 25;
const TIMEOUT = 10000;

const API_KEYS = {
  [MAINNET]: process.env.D3_API_KEY_MAINNET,
  [TESTNET]: process.env.D3_API_KEY_TESTNET
};

export const DEFAULT_CHAIN_ID = MAINNET;

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  if (!constants.d3[chainId]?.apiUrl || !API_KEYS[chainId]) return [];

  const allDomains: Handle[] = [];
  let skip = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      try {
        const response = await fetch(
          `${constants.d3[chainId].apiUrl}/v1/partner/tokens/EVM/${address}?limit=${PAGE_SIZE}&skip=${skip}`,
          {
            headers: { 'Content-Type': 'application/json', 'Api-Key': API_KEYS[chainId] },
            signal: controller.signal
          }
        );

        if (response.status === 404) {
          break;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      } catch (err) {
        capture(err, { input: { address, chainId, skip } });
        break;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return allDomains;
  } catch (err) {
    capture(err);
    return allDomains;
  }
}
