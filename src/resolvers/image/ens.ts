import { isAddress } from '@ethersproject/address';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { fetchHttpImage } from '../../helpers/http';
import { getProvider } from '../../helpers/provider';
import { lookupAddresses } from '../address';

async function castToEnsName(nameOrAddress: string): Promise<string | undefined> {
  if (isAddress(nameOrAddress)) {
    return (await lookupAddresses([nameOrAddress]))[nameOrAddress];
  }

  return nameOrAddress;
}

export default async function resolve(nameOrAddress: string) {
  // getProvider returns `any`. Without the annotation the calls below are unchecked.
  const provider: StaticJsonRpcProvider = getProvider(1);
  const ensName = await castToEnsName(nameOrAddress);

  if (!ensName) return false;

  const ensResolver = await provider.getResolver(ensName);

  if (!ensResolver) {
    return false;
  }

  let url = await ensResolver.getText('avatar');
  url = url?.startsWith('http') ? url : `https://metadata.ens.domains/mainnet/avatar/${ensName}`;

  return await fetchHttpImage(url);
}
