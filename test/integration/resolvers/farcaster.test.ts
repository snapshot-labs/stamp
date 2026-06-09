import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  if (!process.env.NEYNAR_API_KEY) {
    it.todo('is missing NEYNAR_API_KEY');
  } else {
    describe('farcaster', () => {
      it('should return false for invalid address', async () => {
        const result = await resolvers.farcaster(noAvatarInputs.farcasterInvalidAddress);

        expect(result).toBe(false);
      });

      it('should return false for address without farcaster account', async () => {
        const result = await resolvers.farcaster(noAvatarInputs.farcasterNoAccount);

        expect(result).toBe(false);
      });

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
