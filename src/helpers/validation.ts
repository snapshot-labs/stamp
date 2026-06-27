import { z, ZodError } from 'zod';
import { MAX_LOOKUP_ADDRESSES, MAX_RESOLVE_NAMES } from '../addressResolvers';

export const lookupAddressesSchema = z.array(z.string()).nonempty().max(MAX_LOOKUP_ADDRESSES);
export const resolveNamesSchema = z.array(z.string()).nonempty().max(MAX_RESOLVE_NAMES);
export const lookupDomainsSchema = z.string();
export const getOwnerSchema = z.string();

export function formatZodError(error: ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}
