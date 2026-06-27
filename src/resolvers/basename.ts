import { getAvatar } from '../addressResolvers/basename';
import { max } from '../constants.json';
import { resize } from '../utils';
import { fetchHttpImage } from './utils';
import { AvatarId } from '../helpers/validation';

export default async function resolve(nameOrAddress: AvatarId) {
  try {
    const url = await getAvatar(nameOrAddress);
    if (!url) return false;

    return await resize(await fetchHttpImage(url), max, max);
  } catch {
    return false;
  }
}
