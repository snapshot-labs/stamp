import { z, ZodError } from 'zod';
import constants from '../constants.json';
import { RESIZE_FITS } from './image';
import { ResolverType } from './types';

export const schemas = {
  lookup_domains: z.string(),
  get_owner: z.string(),
  lookup_addresses: z.array(z.string()).nonempty().max(constants.maxLookupAddresses),
  resolve_names: z.array(z.string()).nonempty().max(constants.maxResolveNames)
} as const;

const DEFAULT_SIZE = 64;

function dimension(max: number) {
  return z
    .preprocess(v => (v ? parseInt(v as string) : undefined), z.number().min(1).max(max).optional())
    .catch(DEFAULT_SIZE);
}

export function imageQuerySchema(type: ResolverType, resolvers: string[]) {
  const max = type.includes('-cover') ? constants.maxCover : constants.max;

  return z.object({
    s: dimension(max).transform(s => s ?? DEFAULT_SIZE),
    w: dimension(max),
    h: dimension(max),
    fb: z.enum(['blockie', 'jazzicon']).catch('blockie'),
    cb: z.any().optional(),
    fit: z.enum(RESIZE_FITS).optional().catch(undefined),
    resolver: z.preprocess(
      v => v || undefined,
      z.enum(resolvers as [string, ...string[]], { error: 'invalid resolvers' }).optional()
    )
  });
}

export function formatZodError(error: ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}
