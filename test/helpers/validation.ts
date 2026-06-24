import {
  addressSchema,
  AvatarId,
  avatarIdSchema,
  handleSchema,
  ValidatedAddress,
  ValidatedHandle
} from '../../src/helpers/validation';

// Brand literal test inputs through the real schemas (not a bare cast), so a
// malformed literal throws at parse time instead of silently typechecking.
export function address(value: string): ValidatedAddress {
  return addressSchema.parse(value);
}

export function handle(value: string): ValidatedHandle {
  return handleSchema.parse(value);
}

export function avatarId(value: string): AvatarId {
  return avatarIdSchema.parse(value);
}
