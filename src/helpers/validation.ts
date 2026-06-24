import { z } from 'zod';

// Max items per batch for the address based JSON-RPC methods.
export const MAX_LOOKUP_ADDRESSES = 50;
export const MAX_RESOLVE_NAMES = 5;

// Accepts EVM (0x + 40 hex) and Starknet (0x + 64 hex) addresses.
// .brand() makes the parsed output a nominal type, so the compiler can enforce
// that only zod-validated values reach the resolvers.
export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a valid address')
  .or(z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'must be a valid address'))
  .brand('Address');

export type ValidatedAddress = z.infer<typeof addressSchema>;

// A domain handle (e.g. "vitalik.eth"): a non-empty string containing a dot.
export const handleSchema = z
  .string()
  .regex(/^[^\s]*\.[^\s]*$/, 'must be a valid handle')
  .brand('Handle');

export type ValidatedHandle = z.infer<typeof handleSchema>;

export const lookupAddressesSchema = z
  .array(addressSchema)
  .min(1, 'params must contain at least one address')
  .max(MAX_LOOKUP_ADDRESSES, `params must contain less than ${MAX_LOOKUP_ADDRESSES} items`);

// resolve_names receives domain handles (e.g. "vitalik.eth"), not addresses.
export const resolveNamesSchema = z
  .array(handleSchema)
  .min(1, 'params must contain at least one name')
  .max(MAX_RESOLVE_NAMES, `params must contain less than ${MAX_RESOLVE_NAMES} items`);

// lookup_domains is EVM-only, so a narrower regex than addressSchema (which also
// accepts Starknet), but the same Address brand.
export const lookupDomainsSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'params must be a valid address')
  .brand('Address');

// get_owner receives a single domain handle string.
export const getOwnerSchema = z
  .string()
  .regex(/^[^\s]*\.[^\s]*$/, 'params must be a valid handle')
  .brand('Handle');

// Avatar route (GET /:type/:id) id, after stripping any chain prefix and
// lowercasing: must be a valid address or handle. The brand threads into the
// resolvers on the address path.
export const avatarIdSchema = z.union([addressSchema, handleSchema]);

export type AvatarId = z.infer<typeof avatarIdSchema>;

// Human readable summary of a ZodError for the JSON-RPC error `data` field.
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
