import constants from '../../constants.json';
import { graphQlCall } from '../../helpers/graphql';
import { Address, Handle } from '../../helpers/types';

export const NAME = 'Ens V2';
// ENSv2 is L1-bound now that Namechain is cancelled. '1' keeps the dispatcher's
// default chain set unchanged until an ensV2Graphql mainnet entry exists.
export const DEFAULT_CHAIN_ID = '1';
export const CHAIN_IDS = Object.keys(constants.ensV2Graphql);

type Domain = {
  name: string;
  expiryDate?: number;
};

// Measured: first: 1000 succeeds, first: 1001 is rejected by the endpoint.
const PAGE_SIZE = 1000;

export default async function lookupDomains(
  address: Address,
  chainId = DEFAULT_CHAIN_ID
): Promise<Handle[]> {
  const endpoint = constants.ensV2Graphql[chainId];

  if (!endpoint) return [];

  const { data } = await graphQlCall<{ domains: Domain[] }>(
    endpoint,
    `query Domains($where: DomainFilter!, $first: Int!) {
      domains(where: $where, first: $first) {
        name
        expiryDate
      }
    }`,
    { where: { owner: address.toLowerCase() }, first: PAGE_SIZE }
  );

  const now = Date.now() / 1000;

  return data.domains
    .filter(domain => {
      const expiry = Number(domain.expiryDate ?? 0);

      return !expiry || expiry > now;
    })
    .map(domain => domain.name);
}
