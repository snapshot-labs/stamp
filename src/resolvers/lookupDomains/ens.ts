import { capture } from '@snapshot-labs/snapshot-sentry';
import constants from '../../constants.json';
import { graphQlCall } from '../../helpers/graphql';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Ens';
export const DEFAULT_CHAIN_ID = '1';
export const CHAIN_IDS = Object.keys(constants.ensSubgraph);

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

type Domain = {
  name: string;
  labelName?: string;
  expiryDate?: string;
};

type Registration = {
  id: string;
  domain?: Pick<Domain, 'labelName'>;
};

function getLabelHash(domain: Domain) {
  return domain.name.match(/\[(.*?)\]/)?.[1];
}

async function fetchDomainNames(domains: Domain[], chainId: string): Promise<Handle[]> {
  const hashes = [
    ...new Set(domains.map(getLabelHash).filter((hash): hash is string => Boolean(hash)))
  ];

  if (!hashes.length) return domains.map(domain => domain.name);

  const labelNames = new Map<string, string | undefined>();

  for (let offset = 0; offset < hashes.length; offset += PAGE_SIZE) {
    const ids = hashes.slice(offset, offset + PAGE_SIZE).map(hash => `0x${hash}`);
    const {
      data: { data }
    } = await graphQlCall<{ registrations: Registration[] }>(
      constants.ensSubgraph[chainId],
      `query Registrations($ids: [String!]!, $first: Int!) {
        registrations(first: $first, where: { id_in: $ids }) {
          id
          domain {
            labelName
          }
        }
      }`,
      { ids, first: ids.length }
    );

    for (const registration of data.registrations) {
      labelNames.set(registration.id, registration.domain?.labelName);
    }
  }

  return domains.map(domain => {
    const hash = getLabelHash(domain);
    const labelName = hash ? labelNames.get(`0x${hash}`) : undefined;

    return labelName ? domain.name.replace(`[${hash}]`, () => labelName) : domain.name;
  });
}

async function fetchOwnedDomains(address: Address, chainId: string): Promise<Domain[]> {
  const owned: Domain[] = [];
  let domainsSkip = 0;
  let wrappedDomainsSkip = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore && page < MAX_PAGES) {
    const {
      data: {
        data: { account }
      }
    } = await graphQlCall(
      constants.ensSubgraph[chainId],
      `query Domain($id: String!, $first: Int!, $domainsSkip: Int!, $wrappedDomainsSkip: Int!) {
        account(id: $id) {
          domains(first: $first, skip: $domainsSkip) {
            name
            expiryDate
          }
          wrappedDomains(first: $first, skip: $wrappedDomainsSkip) {
            name
            expiryDate
          }
        }
      }`,
      { id: address.toLowerCase(), first: PAGE_SIZE, domainsSkip, wrappedDomainsSkip }
    );

    const domains: Domain[] = account?.domains || [];
    const wrappedDomains: Domain[] = account?.wrappedDomains || [];

    owned.push(...domains, ...wrappedDomains);
    domainsSkip += domains.length;
    wrappedDomainsSkip += wrappedDomains.length;
    hasMore = domains.length === PAGE_SIZE || wrappedDomains.length === PAGE_SIZE;
    page++;
  }

  if (hasMore) {
    capture(new Error('ENS account has more domains than the page cap allows'), {
      contexts: { input: { address, chainId, pages: page, returned: owned.length } }
    });
  }

  return owned;
}

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  if (!constants.ensSubgraph[chainId]) return [];

  const owned = await fetchOwnedDomains(address, chainId);
  const now = (Date.now() / 1000).toFixed(0);
  const domains = owned.filter(
    domain =>
      (!domain.expiryDate || domain.expiryDate === '0' || domain.expiryDate > now) &&
      !domain.name.endsWith('.addr.reverse')
  );

  return fetchDomainNames(domains, chainId);
}
