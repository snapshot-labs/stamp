import { getAvatar } from '../addressResolvers/basename';
import { max } from '../constants.json';
import { resize } from '../utils';
import { fetchHttpImage } from './utils';

export default async function resolve(nameOrAddress: string) {
  const url = await getAvatar(nameOrAddress);
  if (!url) return false;

  return await resize(await fetchHttpImage(url), max, max);
}
