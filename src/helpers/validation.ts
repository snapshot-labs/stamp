import { z, ZodError } from 'zod';

const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const starknetAddressRegex = /^0x[a-fA-F0-9]{64}$/;

const evmAddressSchema = z.string().regex(evmAddressRegex, 'must be an EVM address');
const addressSchema = z
  .string()
  .refine(
    address => evmAddressRegex.test(address) || starknetAddressRegex.test(address),
    'must be an EVM or Starknet address'
  );
const handleSchema = z
  .string()
  .regex(/^[^\s.]+(\.[^\s.]+)+$/, 'must be a handle with non-empty labels');

export const lookupAddressesSchema = z.array(addressSchema).nonempty().max(50);
export const resolveNamesSchema = z.array(handleSchema).nonempty().max(5);
export const lookupDomainsSchema = evmAddressSchema;
export const getOwnerSchema = handleSchema;

export function formatZodError(error: ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}
