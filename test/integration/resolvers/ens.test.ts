import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// ens reads the avatar text record for REAL via an ethers provider, fetches the
// image, then resizes/re-encodes it via sharp. The positive case asserts a
// TOLERANT image snapshot of the real output.
describe('resolvers', () => {
  jest.retryTimes(3);

  describe('ens', () => {
    it('should return false if avatar is not set', async () => {
      const result = await resolvers.ens('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70');

      return expect(result).toBe(false);
    });

    // No-avatar path: a normal, non-special address with no ENS name / avatar, so ens has no
    // default fallback image and returns false.
    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers.ens(NO_AVATAR_ADDRESS);

      return expect(result).toBe(false);
    }, 10e3);

    it('should return false on invalid ENS name', async () => {
      const result = await resolvers.ens('snapshot-test.eth');

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
