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

const HASHED_LABEL = /\[(.*?)\]/g;
const DOMAINS_PAGE_SIZE = 1000;

function getLabelHashes(domain: Domain) {
  return [...domain.name.matchAll(HASHED_LABEL)].map(([, hash]) => hash).filter(Boolean);
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
    ...(account?.wrappedDomains || [])
  ].filter(
    domain =>
      (!domain.expiryDate || domain.expiryDate === '0' || domain.expiryDate > now) &&
      !domain.name.endsWith('.addr.reverse')
  );

  return fetchDomainNames(domains, chainId);
}
