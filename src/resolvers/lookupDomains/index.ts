import { isAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import * as ens from './ens';
import * as shibarium from './shibarium';
import * as unstoppableDomains from './unstoppableDomains';
import { isSilencedError } from '../../helpers/address';
import { timeLookupDomainsResponse as timeResponse } from '../../helpers/metrics';
import { Address, Handle } from '../../utils';

type Provider = {
  NAME: string;
  DEFAULT_CHAIN_ID: string;
  CHAIN_IDS: string[];
  default: (address: Address, chainId: string) => Promise<Handle[]>;
};

// Without the annotation a provider missing NAME still compiles.
const PROVIDERS: Provider[] = [ens, shibarium, unstoppableDomains];

const DEFAULT_CHAIN_IDS = PROVIDERS.map(provider => provider.DEFAULT_CHAIN_ID);

export default async function lookupDomains(
  address: Address,
  chains: string | string[] = DEFAULT_CHAIN_IDS
): Promise<Handle[]> {
  let chainIds = Array.isArray(chains) ? chains : [chains];
  chainIds = [...new Set(chainIds.map(String))];

  if (!isAddress(address)) return [];

  const domains = await Promise.all(
    PROVIDERS.flatMap(({ NAME, default: fn, CHAIN_IDS }) =>
      chainIds
        .filter(chainId => CHAIN_IDS.includes(chainId))
        .map(chainId =>
          (async () => {
            const end = timeResponse.startTimer({ provider: NAME, chainId });
            let status = 0;

            try {
              const result = await fn(address, chainId);
              status = 1;
              return result;
            } catch (err) {
              if (!isSilencedError(err)) {
                capture(err, {
                  tags: { provider: NAME },
                  contexts: { input: { address, chainId } }
                });
              }
              return [];
            } finally {
              end({ status });
            }
          })()
        )
    )
  );

  return [...new Set(domains.flat())];
}
