import { z, ZodError } from 'zod';
import constants from '../constants.json';

export const schemas = {
  lookup_domains: z.string(),
  get_owner: z.string(),
  lookup_addresses: z.array(z.string()).nonempty().max(constants.maxLookupAddresses),
  resolve_names: z.array(z.string()).nonempty().max(constants.maxResolveNames)
} as const;

export function formatZodError(error: ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}
