import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  jest.retryTimes(3);

  describe('ens', () => {
    it('should return false if avatar is not set', async () => {
      const result = await resolvers.ens(noAvatarInputs.ensAvatarNotSet);

      return expect(result).toBe(false);
    });

    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers.ens(NO_AVATAR_ADDRESS);

      return expect(result).toBe(false);
    }, 10e3);

    it('should return false on invalid ENS name', async () => {
      const result = await resolvers.ens(noAvatarInputs.ensInvalidName);

      return expect(result).toBe(false);
    }, 10e3);

    it('resolves and matches the reference avatar', async () => {
      const result = await resolvers.ens(remoteSnapshotInputs.ens);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'ens'
      });
    }, 30e3);
  });
});
