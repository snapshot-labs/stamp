import { isAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { isSilencedError } from '../addressResolvers/utils';
import { timeLookupDomainsResponse as timeResponse } from '../helpers/metrics';
import { Address, Handle } from '../utils';
import ens, {
  CHAIN_IDS as ENS_CHAIN_IDS,
  DEFAULT_CHAIN_ID as ENS_DEFAULT_CHAIN_ID,
  NAME as ENS_NAME
} from './ens';
import shibarium, {
  CHAIN_IDS as SHIBARIUM_CHAIN_IDS,
  DEFAULT_CHAIN_ID as SHIBARIUM_DEFAULT_CHAIN_ID,
  NAME as SHIBARIUM_NAME
} from './shibarium';
import unstoppableDomains, {
  CHAIN_IDS as UNSTOPPABLE_DOMAINS_CHAIN_IDS,
  DEFAULT_CHAIN_ID as UNSTOPPABLE_DOMAINS_DEFAULT_CHAIN_ID,
  NAME as UNSTOPPABLE_DOMAINS_NAME
} from './unstoppableDomains';

type Provider = {
  name: string;
  fn: (address: Address, chainId: string) => Promise<Handle[]>;
  defaultChainId: string;
  chainIds: string[];
};

const PROVIDERS: Provider[] = [
  {
    name: ENS_NAME,
    fn: ens,
    defaultChainId: ENS_DEFAULT_CHAIN_ID,
    chainIds: ENS_CHAIN_IDS
  },
  {
    name: SHIBARIUM_NAME,
    fn: shibarium,
    defaultChainId: SHIBARIUM_DEFAULT_CHAIN_ID,
    chainIds: SHIBARIUM_CHAIN_IDS
  },
  {
    name: UNSTOPPABLE_DOMAINS_NAME,
    fn: unstoppableDomains,
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

  PROVIDERS.forEach(({ name, fn, chainIds: supportedChainIds }) => {
    chainIds
      .filter(chainId => supportedChainIds.includes(chainId))
      .forEach(chainId => {
        promises.push(
          (async () => {
            const end = timeResponse.startTimer({ provider: name, chainId });
            let status = 0;

            try {
              const domains = await fn(address, chainId);
              status = 1;
              return domains;
            } catch (err) {
              if (!isSilencedError(err)) {
                capture(err, {
                  tags: { provider: name },
                  contexts: { input: { address, chainId } }
                });
              }
              return [];
            } finally {
              end({ status });
            }
          })()
        );
      });
  });

  const domains = await Promise.all(promises);

  return [...new Set(domains.flat())];
}
