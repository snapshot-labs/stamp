import { fetchHttpImage } from './utils';
import { getAvatar } from '../addressResolvers/basename';

export default async function resolve(nameOrAddress: string) {
  const url = await getAvatar(nameOrAddress);
  if (!url) return false;

  return await fetchHttpImage(url);
}
