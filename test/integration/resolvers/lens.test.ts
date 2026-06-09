import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions,
  ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// lens resolves the profile picture URL for REAL via the Lens API, fetches the
// image, then resizes/re-encodes it via sharp. The by-handle case asserts a
// TOLERANT image snapshot; the by-address path is asserted as a valid image (it
// resolves the same identity, so a second baseline would be redundant).
describe('resolvers', () => {
  describe('lens', () => {
    it('should return false if missing', async () => {
      const result = await resolvers.lens('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70');

      expect(result).toBe(false);
    });

    it('should return false on invalid address', async () => {
      const result = await resolvers.lens('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70aaa');

      expect(result).toBe(false);
    });

    it('should return false on non-existent domain', async () => {
      const result = await resolvers.lens('non-existent-domain.lens');

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
      const result = await resolvers.lens('0x218F68106128E637fc942C2b1Ed1e3c326125344');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'lens-by-address'
      });
    }, 30e3);

    // Fallback path: the zero address has no Lens account, so lens has no
    // default fallback image and returns false.
    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers.lens(ZERO_ADDRESS);

      expect(result).toBe(false);
    }, 30e3);
  });
});
