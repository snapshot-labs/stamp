import { z } from 'zod';

// Maximum number of items accepted per batch for the address based JSON-RPC
// methods. These mirror the caps previously enforced manually inside
// src/addressResolvers/index.ts.
export const MAX_LOOKUP_ADDRESSES = 50;
export const MAX_RESOLVE_NAMES = 5;

// Branded (nominal) types. zod's .brand() makes the parsed output structurally
// distinct from a plain string so the compiler can enforce that only values
// that went through one of these schemas reach the resolvers. There is no
// runtime difference: an `Address` is still a string at runtime.
//
// Accepts both EVM addresses (0x + 40 hex chars) and Starknet addresses
// (0x + 64 hex chars), matching isEvmAddress / isStarknetAddress.
export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a valid address')
  .or(z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'must be a valid address'))
  .brand('Address');

// Branded INPUT type: a string that has been validated as an address by zod.
// Distinct from the plain `Address` value alias in utils.ts so the compiler can
// enforce that the resolver entry points only receive validated input.
export type ValidatedAddress = z.infer<typeof addressSchema>;

// A domain handle (e.g. "vitalik.eth"): a non-empty string containing a dot.
export const handleSchema = z
  .string()
  .regex(/^[^\s]*\.[^\s]*$/, 'must be a valid handle')
  .brand('Handle');

// Branded INPUT type: a string validated as a handle by zod.
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

// lookup_domains receives a single EVM address string. EVM-only, so it uses a
// narrower regex than the generic address schema (which also accepts Starknet),
// but outputs the same Address brand.
export const lookupDomainsSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'params must be a valid address')
  .brand('Address');

// get_owner receives a single domain handle string.
export const getOwnerSchema = z
  .string()
  .regex(/^[^\s]*\.[^\s]*$/, 'params must be a valid handle')
  .brand('Handle');

// Avatar image route (GET /:type/:id). The `id`, once stripped of any chain
// prefix (eip3770 "eth:0x..", caip10 "eip155:1:0x..", "did:..") and lowercased,
// must be either a valid address or a valid handle/name. Address callers feed
// the address resolvers (which require a branded Address), so this either-or is
// what threads the brand into the avatar path.
export const avatarIdSchema = z.union([addressSchema, handleSchema]);

export type AvatarId = z.infer<typeof avatarIdSchema>;

// Produces a short human readable summary of a ZodError, suitable for the
// JSON-RPC error `data` field or an HTTP 400 message.
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
