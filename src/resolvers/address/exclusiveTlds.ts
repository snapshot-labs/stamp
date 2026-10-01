import { EXCLUSIVE_TLDS as gweiTlds } from './gwei';
import { EXCLUSIVE_TLDS as lensTlds } from './lens';
import { EXCLUSIVE_TLDS as shibariumTlds } from './shibarium';
import { EXCLUSIVE_TLDS as spaceIdTlds } from './spaceId';
import { EXCLUSIVE_TLDS as starknetTlds } from './starknet';
import { Handle } from '../../helpers/types';

const OWNED_TLDS = [gweiTlds, lensTlds, shibariumTlds, spaceIdTlds, starknetTlds].flat();

export function hasOwnedTld(handle: Handle): boolean {
  const normalizedHandle = handle.toLowerCase();
  return OWNED_TLDS.some(tld => normalizedHandle.endsWith(tld));
}
