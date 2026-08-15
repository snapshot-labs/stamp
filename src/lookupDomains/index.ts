import { isAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { isSilencedError } from '../addressResolvers/utils';
import { Address, Handle } from '../utils';
import ens, { CHAIN_IDS as ENS_CHAIN_IDS, DEFAULT_CHAIN_ID as ENS_DEFAULT_CHAIN_ID } from './ens';
import shibarium, {
  CHAIN_IDS as SHIBARIUM_CHAIN_IDS,
  DEFAULT_CHAIN_ID as SHIBARIUM_DEFAULT_CHAIN_ID
} from './shibarium';
import unstoppableDomains, {
  CHAIN_IDS as UNSTOPPABLE_DOMAINS_CHAIN_IDS,
  DEFAULT_CHAIN_ID as UNSTOPPABLE_DOMAINS_DEFAULT_CHAIN_ID
} from './unstoppableDomains';

const PROVIDERS = [
  { lookup: ens, defaultChainId: ENS_DEFAULT_CHAIN_ID, chainIds: ENS_CHAIN_IDS },
  { lookup: shibarium, defaultChainId: SHIBARIUM_DEFAULT_CHAIN_ID, chainIds: SHIBARIUM_CHAIN_IDS },
  {
    lookup: unstoppableDomains,
    defaultChainId: UNSTOPPABLE_DOMAINS_DEFAULT_CHAIN_ID,
    chainIds: UNSTOPPABLE_DOMAINS_CHAIN_IDS
  }
];

const DEFAULT_CHAIN_IDS = PROVIDERS.map(provider => provider.defaultChainId);

export default async function lookupDomains(
  address: Address,
  chains: string | string[] = DEFAULT_CHAIN_IDS
): Promise<Handle[]> {
  const promises: Promise<Handle[]>[] = [];
  let chainIds = Array.isArray(chains) ? chains : [chains];
  chainIds = [...new Set(chainIds.map(String))];

  if (!isAddress(address)) return [];

  PROVIDERS.forEach(({ lookup, chainIds: supportedChainIds }) => {
    chainIds
      .filter(chainId => supportedChainIds.includes(chainId))
      .forEach(chainId => {
        promises.push(
          lookup(address, chainId).catch(err => {
            if (!isSilencedError(err)) capture(err, { input: { address, chainId } });
            return [];
          })
        );
      });
  });

  const domains = await Promise.all(promises);

  return [...new Set(domains.flat())];
}
