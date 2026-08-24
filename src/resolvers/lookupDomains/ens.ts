import { capture } from '@snapshot-labs/snapshot-sentry';
import constants from '../../constants.json';
import { graphQlCall } from '../../helpers/graphql';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Ens';
export const DEFAULT_CHAIN_ID = '1';
export const CHAIN_IDS = Object.keys(constants.ensSubgraph);

type Domain = {
  name: string;
  labelName?: string;
  expiryDate?: number;
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

// names registered on ENSv2, whose ownership does not exist in the v1
// subgraph. A failure only drops the v2 names, never the v1 result
async function fetchV2Domains(address: Address, chainId: string): Promise<Domain[]> {
  const endpoint = constants.ensV2Graphql[chainId];

  if (!endpoint) return [];

  try {
    const { data } = await graphQlCall<{ domains: Domain[] }>(
      endpoint,
      `query Domains($where: DomainFilter!, $first: Int) {
        domains(where: $where, first: $first) {
          name
          expiryDate
        }
      }`,
      {
        where: { owner: address.toLowerCase() },
        first: DOMAINS_PAGE_SIZE
      }
    );

    return data?.domains || [];
  } catch (err) {
    capture(err, { contexts: { input: { address, chainId } } });
    return [];
  }
}

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  if (!constants.ensSubgraph[chainId]) return [];

  const {
    data: { account }
  } = await graphQlCall(
    constants.ensSubgraph[chainId],
    `query Domain($id: String!) {
      account(id: $id) {
        domains {
          name
          expiryDate
        }
        wrappedDomains {
          name
          expiryDate
        }
      }
    }`,
    { id: address.toLowerCase() }
  );

  const now = (Date.now() / 1000).toFixed(0);
  const domains: Domain[] = [
    ...(account?.domains || []),
    ...(account?.wrappedDomains || []),
    ...(await fetchV2Domains(address, chainId))
  ].filter(
    domain =>
      (!domain.expiryDate || domain.expiryDate === '0' || domain.expiryDate > now) &&
      !domain.name.endsWith('.addr.reverse')
  );

  return [...new Set(await fetchDomainNames(domains, chainId))];
}
