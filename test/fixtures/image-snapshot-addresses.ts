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
  snapshotUserAvatarLowercase: '0xef8305e140ac520225daf050e2f71d5fbcc543e7',
  snapshotUserCover: '0xf1f09AdC06aAB740AA16004D62Dbd89484d3Be90',
  snapshotSpaceAvatar: 'ens.eth',
  snapshotSpaceCover: 'test.wa0x6e.eth',
  // space-sx: an sx-gov space avatar resolved on Arbitrum.
  spaceSxArbitrum: '0xFd36252770642Ac48FC3A06d7A1D00be8946dd18',
  // trustwallet: a token logo from the trustwallet/assets repo (very stable).
  trustwallet: { address: '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E' },
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
// WRONG input for a no-avatar test: trustwallet special-cases the native/ETH
// sentinels (the zero address and 0xEeee...EEeE are in its `ETH` list) and
// returns the base-asset (ETH) icon for them, so the zero address does
// NOT exercise the genuine no-avatar path. NO_AVATAR_ADDRESS below is a valid
// but empty mainnet address with no token logo / token entry / profile on any
// of these upstreams, so it exercises the real no-avatar behavior (every one of
// these resolvers returns false for it).
export const NO_AVATAR_ADDRESS = '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70';

// The EVM zero address (0x0000...0000) is intentionally not image-snapshot
// tested: it is special-cased to the base-asset (ETH) icon, so it is not a
// genuine avatar/no-avatar resolver path.

// Starknet zero address. A Starknet address is 0x + up to 64 hex (a felt252),
// NOT a 20-byte ETH address, so the starknet no-avatar/zero case needs a valid
// 64-hex felt. See starknet.test.ts for the full rationale.
export const STARKNET_ZERO_ADDRESS = `0x${'0'.repeat(64)}` as const;

// Real-avatar inputs (positive image-snapshot path): each resolves a genuine
// upstream avatar/icon and is asserted against a committed baseline. Grouped by
// resolver. Some resolvers also resolve the SAME identity by a second input
// (e.g. by-address as well as by-name); those are kept together here.
export const realAvatarInputs = {
  basenameByAddress: '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9',
  lensByAddress: '0x218F68106128E637fc942C2b1Ed1e3c326125344',
  spaceSxOptimism: '0x2EF7E7CF469f5296011664682D58b57D38a3c83f',
  spaceSxStarknet: '0x010841ba1d0c66602aa27837560823e631b19686ebbdcd591caa42a7c01611c0',
  spaceSxStarknetSepolia: '0x00a330d13703f0af4f87e65d95c898297f8ce6e88ac7e9bff3b3bd270d2f6d5b',
  spaceSxSepolia: '0xbFF55fd2A671288316956A0Cae8f1d24BA7E5C9B',
  starknetSimpleAddress: '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a',
  starknetNftHandle: 'pragmarob.stark',
  starknetNftAddress: '0x007b275f7524f39b99a51c7134bc44204fedc5dd1e982e920eb2047c6c2a71f0',
  // A .stark name spelled with StarknetID's bigAlphabet (这, 来). Those glyphs
  // are part of the StarknetID encoding and resolve on-chain, but starknet.js
  // 6.21.2 added an ASCII-only domain regex in front of
  // getAddressFromStarkName, which rejects them with "Invalid domain, must be
  // a valid .stark domain". The avatar resolver swallows that throw and returns
  // false, so this input is the only thing that keeps the starknet pin honest.
  starknetBigAlphabetHandle: '来baba这.stark'
} as const;

// No-avatar / false-path inputs: each is an input for which the resolver is
// EXPECTED to return false (missing identity, invalid input, unsupported network,
// or an upstream default that the resolver rejects). Grouped by resolver and by
// case. These are distinct from the shared NO_AVATAR_ADDRESS, which is the single
// canonical normal-address no-avatar input reused across resolvers.
export const noAvatarInputs = {
  // ens
  ensAvatarNotSet: '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70',
  ensInvalidName: 'snapshot-test.eth',
  // basename
  basenameNoName: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  basenameNonBasenameInput: 'vitalik.eth',
  // lens
  lensMissing: '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70',
  lensInvalidAddress: '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70aaa',
  lensNonExistentDomain: 'non-existent-domain.lens',
  // space-sx
  spaceSxMissing: '0x06ba9855965EeEc09B5D43B113944c27F45aD3Ce',
  spaceSxInvalidAddress: '0x00006ba9855965EeEc09B5D43B113944c27F45aD3Ce',
  // farcaster
  farcasterInvalidAddress: '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70!',
  farcasterNoAccount: '0x2963fD170E12d748d0A80430DdC090e059f6013F',
  // selfid
  selfidMissingDid: '0x290ADCcA6253aCe88b10A6bb34C07a5Ad10fC6B0',
  selfidNoAvatar: '0xd98420cFB1cd92828D192565A824B5728a566B11',
  // starknet
  starknetMissing: 'test-not-existing.stark',
  // starknet.id serves a DEFAULT identicon for this address; the resolver
  // explicitly rejects that default and returns false.
  starknetDefaultIdenticon: '0x0047f2e8dbf39f6856fc2437dfc931e3b3a64bfe240218046f2a9fca80e768d4',
  // snapshot
  snapshotUserMissing: '0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70',
  snapshotSpaceMissing: 'idonthaveensdomain.eth',
  // a real space, but on an unsupported network -> false
  snapshotSpaceUnsupportedNetwork: 'ens.eth'
} as const;
