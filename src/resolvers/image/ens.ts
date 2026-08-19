import { ens_normalize } from '@adraffy/ens-normalize';
import { isAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { hasOwnedTld } from '../../helpers/address';
import { fetchHttpImage } from '../../helpers/http';
import { getProviderOptions } from '../../helpers/provider';
import { lookupAddresses } from '../address';

async function castToEnsName(nameOrAddress: string): Promise<string | undefined> {
  const name = isAddress(nameOrAddress)
    ? (await lookupAddresses([nameOrAddress]))[nameOrAddress]
    : nameOrAddress;

  if (!name?.includes('.')) return undefined;

  try {
    const ensName = ens_normalize(name);
    return hasOwnedTld(ensName) ? undefined : ensName;
  } catch {
    return undefined;
  }
}

export default async function resolve(nameOrAddress: string) {
  const ensName = await castToEnsName(nameOrAddress);

  if (!ensName) return false;

  let url = await snapshot.utils.getEnsTextRecord(ensName, 'avatar', '1', getProviderOptions());
  url = url?.startsWith('http')
    ? url
    : `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(ensName)}`;

  return await fetchHttpImage(url);
}
