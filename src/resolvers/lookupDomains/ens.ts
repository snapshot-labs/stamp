import { capture } from '@snapshot-labs/snapshot-sentry';
import constants from '../../constants.json';
import { graphQlCall } from '../../helpers/graphql';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Ens';
export const DEFAULT_CHAIN_ID = '1';
export const CHAIN_IDS = Object.keys(constants.ensSubgraph);

const ACCOUNT_DOMAINS_LIMIT = 1000;

type Domain = {
  name: string;
  expiryDate?: string;
};

type ResolvedLabel = {
  labelhash: string;
  labelName: string;
};

const HASHED_LABEL = /\[([0-9a-f]{64})\]/g;
// A labelhash isn't unique across domains, so the row count isn't bounded by
// the number of hashes queried; 1000 is what every indexer in the subgraph's
// pool accepts, not a value derived from the query itself.
const DOMAINS_PAGE_SIZE = 1000;

function getLabelHashes(domain: Domain) {
  return [...domain.name.matchAll(HASHED_LABEL)].map(([, hash]) => hash);
}

async function fetchDomainNames(domains: Domain[], chainId: string): Promise<Handle[]> {
  const hashes = [...new Set(domains.flatMap(getLabelHashes))];

  if (!hashes.length) return domains.map(domain => domain.name);

  const { data } = await graphQlCall<{ domains: ResolvedLabel[] }>(
    constants.ensSubgraph[chainId],
    `query Labels($hashes: [Bytes!]!, $first: Int!) {
      domains(first: $first, where: { labelhash_in: $hashes, labelName_not: null }) {
        labelhash
        labelName
      }
    }`,
    {
      hashes: hashes.map(hash => `0x${hash}`),
      first: DOMAINS_PAGE_SIZE
    }
  );
  const labelNames = new Map(
    data.domains.map(({ labelhash, labelName }) => [labelhash, labelName])
  );

  return domains.map(domain =>
    domain.name.replace(HASHED_LABEL, (label, hash) => labelNames.get(`0x${hash}`) || label)
  );
}

async function fetchOwnedDomains(address: Address, chainId: string): Promise<Domain[]> {
  const {
    data: { account }
  } = await graphQlCall(
    constants.ensSubgraph[chainId],
    `query Domain($id: String!, $first: Int!) {
      account(id: $id) {
        domains(first: $first) {
          name
          expiryDate
        }
        wrappedDomains(first: $first) {
          name
          expiryDate
        }
      }
    }`,
    { id: address.toLowerCase(), first: ACCOUNT_DOMAINS_LIMIT }
  );

  const domains: Domain[] = account?.domains || [];
  const wrappedDomains: Domain[] = account?.wrappedDomains || [];

  if (domains.length === ACCOUNT_DOMAINS_LIMIT || wrappedDomains.length === ACCOUNT_DOMAINS_LIMIT) {
    capture(new Error('ENS account has more domains than the request limit allows'), {
      contexts: {
        input: { address, chainId, returned: domains.length + wrappedDomains.length }
      }
    });
  }

  return [...domains, ...wrappedDomains];
}

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  if (!constants.ensSubgraph[chainId]) return [];

  const owned = await fetchOwnedDomains(address, chainId);
  const now = Date.now() / 1000;
  const domains: Domain[] = owned.filter(domain => {
    const expiry = Number(domain.expiryDate ?? 0);

    return domain.name && (!expiry || expiry > now) && !domain.name.endsWith('.addr.reverse');
  });

  return fetchDomainNames(domains, chainId);
}
