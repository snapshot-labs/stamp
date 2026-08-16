import { z, ZodError } from 'zod';
import { MAX_LOOKUP_ADDRESSES, MAX_RESOLVE_NAMES } from '../resolvers/address';

export const schemas = {
  lookup_domains: z.string(),
  get_owner: z.string(),
  lookup_addresses: z.array(z.string()).nonempty().max(MAX_LOOKUP_ADDRESSES),
  resolve_names: z.array(z.string()).nonempty().max(MAX_RESOLVE_NAMES)
} as const;

export function formatZodError(error: ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}
