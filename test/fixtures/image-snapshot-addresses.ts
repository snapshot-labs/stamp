// Dedicated, hardcoded input lists for the resolver image-snapshot tests.
//
// These are intentionally separate from the shared test/fixtures/addresses.ts:
// the committed jest-image-snapshot reference PNGs are pinned to these exact
// values, so they must stay stable and must not depend on a list that other
// tests are free to change.
//
// Every resolver integration test is an image test: it calls the resolver for
// REAL (real network for the remote-fetch resolvers) and asserts the output
// against a committed baseline with toMatchImageSnapshot. No network mocking.
//
// Two flavours of snapshot live here:
//   - EXACT: deterministic resolvers (blockie, jazzicon) render purely from the
//     input, so the baseline matches byte-for-byte (within anti-aliasing noise).
//   - TOLERANT: remote-fetch resolvers (ens, lens, snapshot, space-sx,
//     basename, trustwallet, ...) download a live upstream avatar then resize/
//     re-encode it via sharp. The output can drift slightly with CDN re-encodes,
//     so these use a higher failureThreshold (see remoteSnapshotOptions). Inputs
//     are chosen to be stable identities whose avatar is unlikely to change.

import { MatchImageSnapshotOptions } from 'jest-image-snapshot';

export const blockieSnapshotAddresses = [
  '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046',
  '0x035Bd9F5C8D7176E40b8b2460f9F827079eaC797'
] as const;

export const jazziconSnapshotAddresses = [
  '0x89ceF96c58A85d9bE6DFa46D667e71f45f9Ad046',
  '0x035Bd9F5C8D7176E40b8b2460f9F827079eaC797'
] as const;

// Stable inputs for the remote-fetch resolvers. Each is an established identity
// whose upstream avatar has been stable for a long time.
export const remoteSnapshotInputs = {
  // ENS: long-lived name with a pinned IPFS/HTTP avatar record.
  ens: 'fabien.eth',
  // Basename (Base App): Base founder's name, stable avatar.
  basename: 'jesse.base.eth',
  // Lens: established handle.
  lens: 'fabien.lens',
  // Snapshot hosted avatars (stored on the snapshot infra, very stable).
  snapshotUserAvatar: '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
  snapshotUserCover: '0xf1f09AdC06aAB740AA16004D62Dbd89484d3Be90',
  snapshotSpaceAvatar: 'ens.eth',
  snapshotSpaceCover: 'test.wa0x6e.eth',
  // space-sx: an sx-gov space avatar resolved on Arbitrum.
  spaceSxArbitrum: '0xFd36252770642Ac48FC3A06d7A1D00be8946dd18',
  // trustwallet: a token logo from the trustwallet/assets repo (very stable).
  trustwallet: { address: '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E', chainId: '' },
  // zapper: a token icon served by zapper's CDN.
  zapper: { address: '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72', chainId: '' },
  // coingecko: token metadata image (needs COINGECKO_API_KEY).
  coingecko: { address: '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72', chainId: '1' },
  // farcaster: address with a Farcaster pfp (needs NEYNAR_API_KEY).
  farcaster: '0xd1a8Dd23e356B9fAE27dF5DeF9ea025A602EC81e'
} as const;

// Tolerant config for remote-fetch resolvers: allow a small percentage of
// differing pixels so a benign upstream/CDN re-encode does not fail the test.
// The default setup-jest threshold (0.01%) is too strict for remotely fetched,
// re-encoded images.
export const remoteSnapshotOptions: MatchImageSnapshotOptions = {
  failureThreshold: 1.5,
  failureThresholdType: 'percent'
};

// The canonical "no avatar set" input used to exercise each resolver's real
// no-avatar path.
//
// IMPORTANT: this is a NORMAL, non-special address. The zero address is the
// WRONG input for a no-avatar test: trustwallet and zapper special-case the
// native/ETH sentinels (the zero address and 0xEeee...EEeE are in their `ETH`
// list) and return the base-asset (ETH) icon for them, so the zero address does
// NOT exercise the genuine no-avatar path. NO_AVATAR_ADDRESS below is a valid
// but empty mainnet address with no token logo / token entry / profile on any
// of these upstreams, so it exercises the real no-avatar behavior (every one of
// these resolvers returns false for it).
export const NO_AVATAR_ADDRESS = '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70';

// The native-asset sentinel. trustwallet/zapper map this (and the zero address)
// to the base-asset (ETH) icon via getBaseAssetIconUrl. This is a SEPARATE case
// from no-avatar: it returns the ETH fallback image, not false. Kept only where
// a resolver actually special-cases it.
export const NATIVE_ASSET_ADDRESS = '0x0000000000000000000000000000000000000000';
