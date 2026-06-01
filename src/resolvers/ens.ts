import { isAddress } from '@ethersproject/address';
import { max } from '../constants.json';
import { getProvider, resize } from '../utils';
import { fetchHttpImage } from './utils';
import { lookupAddresses } from '../addressResolvers';

async function castToEnsName(nameOrAddress: string): Promise<string | undefined> {
  if (isAddress(nameOrAddress)) {
    return (await lookupAddresses([nameOrAddress]))[nameOrAddress];
  }

  return nameOrAddress;
}

export default async function resolve(nameOrAddress: string) {
  try {
    const provider = getProvider(1);
    const ensName = await castToEnsName(nameOrAddress);

    if (!ensName) return false;

    const ensResolver = await provider.getResolver(ensName);

    if (!ensResolver) {
      return false;
    }

    let url = await ensResolver.getText('avatar');
    url = url?.startsWith('http') ? url : `https://metadata.ens.domains/mainnet/avatar/${ensName}`;

    const input = await fetchHttpImage(url);

    return await resize(input, max, max);
  } catch {
    return false;
  }
}
