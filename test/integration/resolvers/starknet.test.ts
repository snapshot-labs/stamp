import resolvers from '../../../src/resolvers';
import { remoteSnapshotOptions } from '../../fixtures/image-snapshot-addresses';
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
// fallback baseline image to snapshot for starknet.
const STARKNET_ZERO_ADDRESS = `0x${'0'.repeat(64)}`;

describe('resolvers', () => {
  describe('starknet', () => {
    jest.retryTimes(3);

    it('should return false if missing', async () => {
      const result = await resolvers.starknet('test-not-existing.stark');

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers.starknet(STARKNET_ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    describe('with a simple image', () => {
      it('resolves with address and matches the reference', async () => {
        const result = await resolvers.starknet(
          '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a'
        );

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-simple'
        });
      }, 30e3);
    });

    describe('with the default image', () => {
      it('should return false', async () => {
        const result = await resolvers.starknet(
          '0x0047f2e8dbf39f6856fc2437dfc931e3b3a64bfe240218046f2a9fca80e768d4'
        );

        expect(result).toBe(false);
      });
    });

    describe('with an NFT image', () => {
      it('resolves with handle and matches the reference', async () => {
        const result = await resolvers.starknet('pragmarob.stark');

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-nft-handle'
        });
      }, 30e3);

      it('resolves with address and matches the reference', async () => {
        const result = await resolvers.starknet(
          '0x007b275f7524f39b99a51c7134bc44204fedc5dd1e982e920eb2047c6c2a71f0'
        );

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-nft-address'
        });
      }, 30e3);
    });
  });
});
