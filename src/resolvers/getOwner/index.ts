import shibarium from './shibarium';
import { Address, Handle } from '../../utils';

export default async function getOwner(handle: Handle, chainId = '1'): Promise<Address> {
  return shibarium(handle, chainId);
}
