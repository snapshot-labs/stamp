import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// farcaster resolves a Warpcast pfp URL for REAL via Neynar (needs
// NEYNAR_API_KEY), fetches it, then resizes via sharp. The positive case asserts
// a TOLERANT image snapshot of the real output. The fallback path (no farcaster
// account / invalid / a normal address with no account) returns false: farcaster has no default
// fallback image.
describe('resolvers', () => {
  if (!process.env.NEYNAR_API_KEY) {
    it.todo('is missing NEYNAR_API_KEY');
  } else {
    describe('farcaster', () => {
      it('should return false for invalid address', async () => {
        const result = await resolvers.farcaster('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70!');

        expect(result).toBe(false);
      });

      it('should return false for address without farcaster account', async () => {
        const result = await resolvers.farcaster('0x2963fD170E12d748d0A80430DdC090e059f6013F');

        expect(result).toBe(false);
      });

      // No-avatar path: a normal, non-special address with no Farcaster account.
      // farcaster has no default fallback image, so it returns false. (The zero
      // address is avoided so the false is a real no-avatar result, not an
      // artifact of a special-cased input.)
      it('returns false for a normal address with no farcaster account', async () => {
        const result = await resolvers.farcaster(NO_AVATAR_ADDRESS);

        expect(result).toBe(false);
      });

      it('resolves and matches the reference avatar', async () => {
        const result = await resolvers.farcaster(remoteSnapshotInputs.farcaster);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'farcaster'
        });
      }, 30e3);
    });
  }
});
