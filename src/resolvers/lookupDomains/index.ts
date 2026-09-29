import { isAddress } from '@ethersproject/address';
import * as ens from './ens';
import * as ensV2 from './ensV2';
import * as shibarium from './shibarium';
import * as unstoppableDomains from './unstoppableDomains';
import { isTestnet } from '../../helpers/chains';
import { timeLookupDomainsResponse as timeResponse } from '../../helpers/metrics';
import { callResolver } from '../../helpers/resolver';
import { Address, Handle } from '../../helpers/types';

type Provider = {
  NAME: string;
  CHAIN_IDS: string[];
  default: (address: Address, chainId: string) => Promise<Handle[]>;
};

// Without the annotation a provider missing NAME still compiles.
const PROVIDERS: Provider[] = [ens, ensV2, shibarium, unstoppableDomains];

// A provider can only widen the default set with a mainnet chain it serves, so a
// testnet-only one contributes nothing and cannot drag a sibling onto a new chain.
const DEFAULT_CHAIN_IDS = [...new Set(PROVIDERS.flatMap(provider => provider.CHAIN_IDS))].filter(
  chainId => !isTestnet(chainId)
);

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
          callResolver(() => fn(address, chainId), {
            provider: NAME,
            input: { address, chainId },
            empty: [],
            endTimer: timeResponse.startTimer({ provider: NAME, chainId })
          })
        )
    )
  );

  return [...new Set(domains.flat())];
}
