import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions,
  ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// farcaster resolves a Warpcast pfp URL for REAL via Neynar (needs
// NEYNAR_API_KEY), fetches it, then resizes via sharp. The positive case asserts
// a TOLERANT image snapshot of the real output. The fallback path (no farcaster
// account / invalid / zero address) returns false: farcaster has no default
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

      it('returns false for the zero address (no fallback image)', async () => {
        const result = await resolvers.farcaster(ZERO_ADDRESS);

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
