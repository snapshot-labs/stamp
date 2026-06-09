import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  describe('snapshot', () => {
    describe('on user avatar', () => {
      it('should return false if missing', async () => {
        const result = await resolvers.snapshot(noAvatarInputs.snapshotUserMissing);

        expect(result).toBe(false);
      });

      it('returns false for a normal address with no avatar', async () => {
        const result = await resolvers.snapshot(NO_AVATAR_ADDRESS);

        expect(result).toBe(false);
      });

      it('resolves regardless of network and matches the reference avatar', async () => {
        const result = await resolvers.snapshot(remoteSnapshotInputs.snapshotUserAvatar, 1, 'eth');

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'snapshot-user-avatar'
        });
      }, 30e3);
    });
  });

  describe('on user cover', () => {
    it('should return false if missing', async () => {
      const result = await resolvers['user-cover'](noAvatarInputs.snapshotUserMissing);

      expect(result).toBe(false);
    });

    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers['user-cover'](NO_AVATAR_ADDRESS);

      expect(result).toBe(false);
    });

    it('resolves regardless of network and matches the reference cover', async () => {
      const result = await resolvers['user-cover'](
        remoteSnapshotInputs.snapshotUserCover,
        1,
        'eth'
      );

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-user-cover'
      });
    }, 30e3);
  });

  describe('on space avatar', () => {
    it('should return false if missing', async () => {
      const result = await resolvers.space(noAvatarInputs.snapshotSpaceMissing);

      expect(result).toBe(false);
    });

    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers.space(NO_AVATAR_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return false on unsupported network', async () => {
      const result = await resolvers.space(
        noAvatarInputs.snapshotSpaceUnsupportedNetwork,
        1,
        'eth'
      );

      expect(result).toBe(false);
    });

    it('resolves and matches the reference avatar', async () => {
      const result = await resolvers.space(remoteSnapshotInputs.snapshotSpaceAvatar);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-space-avatar'
      });
    }, 30e3);

    it('should return same result for both legacy and non-legacy format', async () => {
      const resultA = await resolvers.space(remoteSnapshotInputs.snapshotSpaceAvatar);
      const resultB = await resolvers.space(remoteSnapshotInputs.snapshotSpaceAvatar, 1, 's');

      expect(resultA).toEqual(resultB);
    });
  });

  describe('on space cover', () => {
    it('should return false if missing', async () => {
      const result = await resolvers['space-cover'](noAvatarInputs.snapshotSpaceMissing);

      expect(result).toBe(false);
    });

    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers['space-cover'](NO_AVATAR_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return false on unsupported network', async () => {
      const result = await resolvers['space-cover'](
        remoteSnapshotInputs.snapshotSpaceCover,
        1,
        'eth'
      );

      expect(result).toBe(false);
    });

    it('resolves and matches the reference cover', async () => {
      const result = await resolvers['space-cover'](remoteSnapshotInputs.snapshotSpaceCover);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'snapshot-space-cover'
      });
    }, 30e3);

    it('should return same result for both legacy and non-legacy format', async () => {
      const resultA = await resolvers['space-cover'](remoteSnapshotInputs.snapshotSpaceCover);
      const resultB = await resolvers['space-cover'](
        remoteSnapshotInputs.snapshotSpaceCover,
        1,
        's'
      );

      expect(resultA).toEqual(resultB);
    });
  });
});
