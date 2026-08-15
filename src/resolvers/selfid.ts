import { getAddress } from '@ethersproject/address';
import { Core } from '@self.id/core';
import { getUrl } from '../utils';
import { fetchHttpImage } from './utils';

const core = new Core({ ceramic: 'https://gateway.ceramic.network' });

export default async function resolve(address: string) {
  const did = await core.getAccountDID(`${getAddress(address)}@eip155:1`);
  const result = await core.get('basicProfile', did);

  const { src } = result?.image?.original || {};
  if (!src) return false;

  const url = getUrl(src);
  return await fetchHttpImage(url);
}
