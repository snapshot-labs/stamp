import { isAddress } from '@ethersproject/address';
import { max } from '../constants.json';
import { resize } from '../utils';
import { fetchHttpImage } from './utils';
import { lookupAddresses } from '../addressResolvers';
import { getTextRecord } from '../addressResolvers/universalResolver';

async function castToEnsName(nameOrAddress: string): Promise<string | undefined> {
  if (isAddress(nameOrAddress)) {
    return (await lookupAddresses([nameOrAddress]))[nameOrAddress];
  }

  return nameOrAddress;
}

export default async function resolve(nameOrAddress: string) {
  try {
    const ensName = await castToEnsName(nameOrAddress);

    if (!ensName) return false;

    const record = await getTextRecord(ensName, 'avatar');
    const url =
      record && record.startsWith('http')
        ? record
        : `https://metadata.ens.domains/mainnet/avatar/${ensName}`;

    const input = await fetchHttpImage(url);

    return await resize(input, max, max);
  } catch {
    return false;
  }
}
