import { max } from '../constants.json';
import { getProvider, resize } from '../utils';
import { fetchHttpImage } from './utils';
import { lookupAddresses } from '../addressResolvers';
import { addressSchema, AvatarId } from '../helpers/validation';

async function castToEnsName(nameOrAddress: AvatarId): Promise<string | undefined> {
  // Re-derive the Address brand from the already validated id: when it is an
  // address, feed the branded value into lookupAddresses; otherwise it is a
  // handle and used as-is.
  const asAddress = addressSchema.safeParse(nameOrAddress);
  if (asAddress.success) {
    return (await lookupAddresses([asAddress.data]))[asAddress.data];
  }

  return nameOrAddress;
}

export default async function resolve(nameOrAddress: AvatarId) {
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
