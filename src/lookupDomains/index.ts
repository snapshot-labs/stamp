import { ValidatedAddress } from '../helpers/validation';
import { Handle } from '../utils';
import ens, { DEFAULT_CHAIN_ID as ENS_DEFAULT_CHAIN_ID } from './ens';
import shibarium, { DEFAULT_CHAIN_ID as SHIBARIUM_DEFAULT_CHAIN_ID } from './shibarium';
import unstoppableDomains, {
  DEFAULT_CHAIN_ID as UNSTOPPABLE_DOMAINS_DEFAULT_CHAIN_ID
} from './unstoppableDomains';

const RESOLVERS = [ens, shibarium, unstoppableDomains];

const DEFAULT_CHAIN_IDS = [
  ENS_DEFAULT_CHAIN_ID,
  SHIBARIUM_DEFAULT_CHAIN_ID,
  UNSTOPPABLE_DOMAINS_DEFAULT_CHAIN_ID
];

export default async function lookupDomains(
  address: ValidatedAddress,
  chains: string | string[] = DEFAULT_CHAIN_IDS
): Promise<Handle[]> {
  const promises: Promise<Handle[]>[] = [];
  let chainIds = Array.isArray(chains) ? chains : [chains];
  chainIds = [...new Set(chainIds.map(String))];

  // The address shape is now guaranteed by the branded Address type: the only
  // caller (src/api.ts lookup_domains) validates it with lookupDomainsSchema at
  // the boundary, so the previous runtime isAddress guard is redundant.

  RESOLVERS.forEach(resolver => {
    chainIds.forEach(chain => {
      promises.push(resolver(address, chain));
    });
  });

  const domains = await Promise.all(promises);

  return [...new Set(domains.flat())];
}
