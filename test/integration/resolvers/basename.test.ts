import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// basename resolves the Base App avatar URL for REAL, fetches the image, then
// resizes/re-encodes it via sharp. The by-name case asserts a TOLERANT image
// snapshot; the by-address path is asserted as a valid image (it resolves the
// same identity, so a second baseline would be redundant).
describe('resolvers', () => {
  jest.retryTimes(3);

  describe('basename', () => {
    it('resolves an avatar by basename and matches the reference', async () => {
      const result = await resolvers.basename(remoteSnapshotInputs.basename);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'basename'
      });
    }, 30e3);

    it('resolves an avatar by address and matches the reference', async () => {
      const result = await resolvers.basename('0x2211d1D0020DAEA8039E46Cf1367962070d77DA9');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'basename-by-address'
      });
    }, 30e3);

    // No-avatar path: a normal, non-special address without a basename has no
    // avatar, so basename has no default fallback image and returns false.
    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers.basename(NO_AVATAR_ADDRESS);

      return expect(result).toBe(false);
    }, 30e3);

    it('should return false for an address without a basename', async () => {
      const result = await resolvers.basename('0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1');

      return expect(result).toBe(false);
    }, 30e3);

    it('should return false for a non-basename input', async () => {
      const result = await resolvers.basename('vitalik.eth');

      return expect(result).toBe(false);
    }, 10e3);
  });
});
