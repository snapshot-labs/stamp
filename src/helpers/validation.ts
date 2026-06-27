import { z, ZodError } from 'zod';

export const MAX_LOOKUP_ADDRESSES = 50;
export const MAX_RESOLVE_NAMES = 5;

const addressSchema = z.string().regex(/^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/);
const handleSchema = z.string().regex(/^[^\s.]+(?:\.[^\s.]+)+$/);
const routeIdSchema = z.string().min(1).regex(/^\S+$/);

export const avatarIdSchema = z.union([addressSchema, handleSchema]);
export const imageRouteIdSchemas = {
  avatar: avatarIdSchema,
  'user-cover': avatarIdSchema,
  token: routeIdSchema,
  space: routeIdSchema,
  'space-cover': routeIdSchema,
  'space-logo': routeIdSchema,
  'space-sx': routeIdSchema,
  'space-cover-sx': routeIdSchema
} as const;
export type AvatarId = z.infer<typeof avatarIdSchema>;

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
