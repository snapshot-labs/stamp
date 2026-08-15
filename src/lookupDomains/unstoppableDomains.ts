import { Address, Handle } from '../utils';

export const DEFAULT_CHAIN_ID = '146';
export const CHAIN_IDS = [DEFAULT_CHAIN_ID];

const SUPPORTED_TLDS = ['sonic'];

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => SUPPORTED_TLDS.some(tld => h.endsWith(`.${tld}`)));
}

async function fetchDomains(
  address: string,
  cursor: string
): Promise<Record<'data' | 'next', any>> {
  const response = await fetch(
    `https://api.unstoppabledomains.com/resolve/owners/${address}/domains?cursor=${cursor}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.UNSTOPPABLE_DOMAINS_API_KEY || ''}`
      }
    }
  );

  if (!response.ok) {
    throw Object.assign(
      new Error(`Unstoppable Domains API error: HTTP ${response.status} ${response.statusText}`),
      { status: response.status }
    );
  }

  const data = await response.json();

  if (!Array.isArray(data?.data)) {
    throw new Error('Unstoppable Domains API error: response body is missing a data array');
  }

  return data;
}

export default async function lookupDomains(address: Address, chainId: string): Promise<Handle[]> {
  if (chainId !== DEFAULT_CHAIN_ID) return [];

  if (!process.env.UNSTOPPABLE_DOMAINS_API_KEY) {
    return [];
  }

  const domains: string[] = [];
  let cursor = '0';

  while (cursor !== null) {
    const data = await fetchDomains(address, cursor);
    cursor = data.next?.split('cursor=').pop() || null;
    domains.push(...data.data.map((domain: any) => domain.meta.domain));
  }

  return normalizeHandles(domains);
}
