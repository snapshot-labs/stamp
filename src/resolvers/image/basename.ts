import { fetchHttpImage } from '../../helpers/http';
import { getAvatar } from '../address/basename';

export default async function resolve(nameOrAddress: string) {
  const url = await getAvatar(nameOrAddress);
  if (!url) return false;

  return await fetchHttpImage(url);
}
