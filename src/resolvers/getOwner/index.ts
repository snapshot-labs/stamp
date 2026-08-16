import shibarium from './shibarium';
import { Address, Handle } from '../../helpers/types';

export default async function getOwner(handle: Handle, chainId = '1'): Promise<Address> {
  return shibarium(handle, chainId);
}
