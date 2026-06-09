import resolvers from '../../../src/resolvers';
import {
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotOptions,
  STARKNET_ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// starknet resolves a Starknet profile picture (plain image or NFT metadata) for
// REAL, then resizes/re-encodes via sharp. Every image-returning case asserts a
// TOLERANT image snapshot of the real output. The fallback path (no profile, the
// default identicon, or the zero address) returns false: starknet has no default
// fallback image of its own (the upstream default identicon is rejected).
//
// NOTE: a Starknet address is 0x + up to 64 hex (a felt252), NOT a 20-byte ETH
// address. The no-avatar input below is therefore a VALID 64-hex Starknet felt,
// so it passes normalizeAddress and the false is a REAL no-avatar result, not an
// input-validation artifact. Verified against the live RPC: getStarkProfile for
// this address succeeds and returns
// profilePicture === 'https://starknet.id/api/identicons/0' (the DEFAULT_IMG_URL
// the resolver explicitly rejects), so resolve() returns false. There is no
// fallback baseline image to snapshot for starknet. STARKNET_ZERO_ADDRESS lives
// in the central fixtures.

describe('resolvers', () => {
  describe('starknet', () => {
    jest.retryTimes(3);

    it('should return false if missing', async () => {
      const result = await resolvers.starknet(noAvatarInputs.starknetMissing);

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers.starknet(STARKNET_ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    describe('with a simple image', () => {
      it('resolves with address and matches the reference', async () => {
        const result = await resolvers.starknet(realAvatarInputs.starknetSimpleAddress);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-simple'
        });
      }, 30e3);
    });

    // DELIBERATE BEHAVIOR (documented, not a test artifact): when an address has
    // no custom profile picture, starknet.id still serves a DEFAULT identicon at
    // DEFAULT_IMG_URL ('https://starknet.id/api/identicons/0'). The resolver
    // EXPLICITLY REJECTS that default and returns false, so this is the real
    // no-avatar result for starknet: it has no fallback image of its own.
    //
    // OPEN QUESTION for wa0x6e: should starknet stop rejecting the default
    // identicon and instead snapshot/return it as a fallback image (like an
    // avatar)? That is a behavior change and his call; this test is NOT changing
    // the resolver, only documenting and pinning the current reject-to-false
    // behavior.
    describe('with the default image (starknet.id default identicon, rejected)', () => {
      it('should return false', async () => {
        const result = await resolvers.starknet(noAvatarInputs.starknetDefaultIdenticon);

        expect(result).toBe(false);
      });
    });

    describe('with an NFT image', () => {
      it('resolves with handle and matches the reference', async () => {
        const result = await resolvers.starknet(realAvatarInputs.starknetNftHandle);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-nft-handle'
        });
      }, 30e3);

      it('resolves with address and matches the reference', async () => {
        const result = await resolvers.starknet(realAvatarInputs.starknetNftAddress);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-nft-address'
        });
      }, 30e3);
    });
  });
});
