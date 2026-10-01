import { withDeadline } from '../../helpers/deadline';
import { httpError } from '../../helpers/errors';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Unstoppable Domains';
export const DEFAULT_CHAIN_ID = '146';
export const CHAIN_IDS = [DEFAULT_CHAIN_ID];

const SUPPORTED_TLDS = ['sonic'];

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => SUPPORTED_TLDS.some(tld => h.endsWith(`.${tld}`)));
}

async function fetchDomains(
  address: string,
  cursor: string,
  signal: AbortSignal
): Promise<{ data: { meta: { domain: string } }[]; next?: string | null }> {
  const response = await fetch(
    `https://api.unstoppabledomains.com/resolve/owners/${address}/domains?cursor=${cursor}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.UNSTOPPABLE_DOMAINS_API_KEY || ''}`
      },
      signal
    }
  );

  if (!response.ok) {
    throw httpError(
      'unstoppable-domains',
      response.status,
      `HTTP ${response.status} ${response.statusText}`
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

  return withDeadline(async signal => {
    const domains: string[] = [];
    let cursor: string | null = '0';

    while (cursor !== null) {
      const data = await fetchDomains(address, cursor, signal);
      cursor = data.next?.split('cursor=').pop() || null;
      domains.push(...data.data.map(domain => domain.meta.domain));
    }

    return normalizeHandles(domains);
  });
}
