import { z } from 'zod';

// Maximum number of items accepted per batch for the address based JSON-RPC
// methods. These mirror the caps previously enforced manually inside
// src/addressResolvers/index.ts.
export const MAX_LOOKUP_ADDRESSES = 50;
export const MAX_RESOLVE_NAMES = 5;

// Accepts both EVM addresses (0x + 40 hex chars) and Starknet addresses
// (0x + 64 hex chars), matching isEvmAddress / isStarknetAddress.
const addressString = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a valid address')
  .or(z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'must be a valid address'));

export const lookupAddressesSchema = z
  .array(addressString)
  .min(1, 'params must contain at least one address')
  .max(MAX_LOOKUP_ADDRESSES, `params must contain less than ${MAX_LOOKUP_ADDRESSES} items`);

// resolve_names receives domain handles (e.g. "vitalik.eth"), not addresses.
const handleString = z.string().regex(/^[^\s]*\.[^\s]*$/, 'must be a valid handle');

export const resolveNamesSchema = z
  .array(handleString)
  .min(1, 'params must contain at least one name')
  .max(MAX_RESOLVE_NAMES, `params must contain less than ${MAX_RESOLVE_NAMES} items`);

// lookup_domains receives a single EVM address string.
export const lookupDomainsSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'params must be a valid address');

// get_owner receives a single domain handle string.
export const getOwnerSchema = z.string().regex(/^[^\s]*\.[^\s]*$/, 'params must be a valid handle');

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
