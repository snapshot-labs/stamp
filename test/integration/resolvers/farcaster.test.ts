import resolvers from '../../../src/resolvers';
import { remoteSnapshotInputs } from '../../fixtures/image-snapshot-addresses';

// farcaster resolves a Warpcast pfp URL for REAL via Neynar (needs
// NEYNAR_API_KEY), fetches it, then resizes via sharp. Warpcast pfps are
// user-editable and served by a hot CDN, so this is ASSERTION-ONLY (valid
// image) rather than a pixel snapshot to avoid a guaranteed-flaky baseline.
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

      it('should resolve to a valid image', async () => {
        const result = await resolvers.farcaster(remoteSnapshotInputs.farcaster);

        expect(result).toBeInstanceOf(Buffer);
        expect((result as Buffer).length).toBeGreaterThan(1000);
      }, 30e3);
    });
  }
});
