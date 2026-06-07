import {
  addressSchema,
  AvatarId,
  avatarIdSchema,
  handleSchema,
  ValidatedAddress,
  ValidatedHandle
} from '../../src/helpers/validation';

// Test helpers that brand literal inputs by running them through the real zod
// schemas, the same way the production entry points do. Using the schemas here
// (rather than a bare cast) keeps the test inputs honest: a malformed literal
// throws at parse time instead of silently typechecking.
export function address(value: string): ValidatedAddress {
  return addressSchema.parse(value);
}

export function handle(value: string): ValidatedHandle {
  return handleSchema.parse(value);
}

export function avatarId(value: string): AvatarId {
  return avatarIdSchema.parse(value);
}
