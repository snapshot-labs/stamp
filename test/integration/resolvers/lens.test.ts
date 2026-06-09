import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  describe('lens', () => {
    it('should return false if missing', async () => {
      const result = await resolvers.lens(noAvatarInputs.lensMissing);

      expect(result).toBe(false);
    });

    it('should return false on invalid address', async () => {
      const result = await resolvers.lens(noAvatarInputs.lensInvalidAddress);

      expect(result).toBe(false);
    });

    it('should return false on non-existent domain', async () => {
      const result = await resolvers.lens(noAvatarInputs.lensNonExistentDomain);

      expect(result).toBe(false);
    });

    it('resolves with handle and matches the reference avatar', async () => {
      const result = await resolvers.lens(remoteSnapshotInputs.lens);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'lens'
      });
    }, 30e3);

    it('resolves with address and matches the reference avatar', async () => {
      const result = await resolvers.lens(realAvatarInputs.lensByAddress);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'lens-by-address'
      });
    }, 30e3);

    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers.lens(NO_AVATAR_ADDRESS);

      expect(result).toBe(false);
    }, 30e3);
  });
});
