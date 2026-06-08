// Dedicated, hardcoded address lists for the image / pixel snapshot tests.
//
// These are intentionally separate from the shared test/fixtures/addresses.ts:
// the committed jest-image-snapshot reference PNGs are pinned to these exact
// values, so they must stay stable and must not depend on a list that other
// tests are free to change.
//
// Each resolver gets its own list so that resolvers with their own reference
// addresses can be added later without disturbing the existing baselines.

export const blockieSnapshotAddresses = [
  '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046',
  '0x035Bd9F5C8D7176E40b8b2460f9F827079eaC797'
] as const;

export const jazziconSnapshotAddresses = [
  '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046',
  '0x035Bd9F5C8D7176E40b8b2460f9F827079eaC797'
] as const;
