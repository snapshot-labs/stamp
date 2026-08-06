import { Core } from '@self.id/core';
import { max } from '../constants.json';
import { getUrl, resize } from '../utils';
import { fetchHttpImage, toChecksumAddress } from './utils';

const core = new Core({ ceramic: 'https://gateway.ceramic.network' });

export default async function resolve(address: string) {
  const checksum = toChecksumAddress(address);
  if (!checksum) return false;

  const did = await core.getAccountDID(`${checksum}@eip155:1`);
  const result = await core.get('basicProfile', did);

  const { src } = result?.image?.original || {};
  if (!src) return false;

  const url = getUrl(src);
  const input = await fetchHttpImage(url);
  return await resize(input, max, max);
}
