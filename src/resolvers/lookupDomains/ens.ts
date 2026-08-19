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

type Registration = {
  id: string;
  domain?: Pick<Domain, 'labelName'>;
};

function getLabelHash(domain: Domain) {
  return domain.name.match(/\[(.*?)\]/)?.[1];
}

async function fetchDomainData(domains: Domain[], chainId: string): Promise<Domain[]> {
  const hashes = [
    ...new Set(domains.map(getLabelHash).filter((hash): hash is string => Boolean(hash)))
  ];

  if (!hashes.length) return domains;

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
    {
      ids: hashes.map(hash => `0x${hash}`),
      first: hashes.length
    }
  );
  const labelNames = new Map(
    data.registrations.map(registration => [registration.id, registration.domain?.labelName])
  );

  return domains.map(domain => {
    const hash = getLabelHash(domain);
    const labelName = hash ? labelNames.get(`0x${hash}`) : undefined;

    return {
      ...domain,
      name: labelName ? domain.name.replace(`[${hash}]`, () => labelName) : domain.name
    };
  });
}

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  if (!constants.ensSubgraph[chainId]) return [];

  const {
    data: {
      data: { account }
    }
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

  return (await fetchDomainData(domains, chainId)).map(domain => domain.name);
}
