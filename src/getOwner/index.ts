import { ValidatedHandle } from '../helpers/validation';
import { Address } from '../utils';
import shibarium from './shibarium';

export default async function getOwner(handle: ValidatedHandle, chainId = '1'): Promise<Address> {
  return shibarium(handle, chainId);
}
