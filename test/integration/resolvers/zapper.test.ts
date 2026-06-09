import resolvers from '../../../src/resolvers';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// zapper fetches a token icon from zapper's CDN for REAL, then resizes/
// re-encodes it via sharp. The baseline is TOLERANT to absorb CDN re-encodes.
describe('resolvers', () => {
  describe('zapper', () => {
    // No-avatar path: a normal, non-special address with no icon on zapper's
    // CDN. The upstream returns 404, the fetch throws, and the resolver returns
    // false. This is the genuine no-avatar result. Each case below asserts
    // exactly one outcome: either false OR an image, never both.
    it('returns false for a normal address with no token icon', async () => {
      const result = await resolvers.zapper(NO_AVATAR_ADDRESS, '');

      expect(result).toBe(false);
    });

    it('resolves and matches the reference icon', async () => {
      const { address, chainId } = remoteSnapshotInputs.zapper;
      const result = await resolvers.zapper(address, chainId);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'zapper'
      });
    }, 30e3);

    // Native-asset sentinel (SEPARATE from the no-avatar path): the zero address
    // is in the resolver's ETH list, so zapper special-cases it to the
    // base-asset (ETH) icon via getBaseAssetIconUrl. Snapshot that ETH image.
    it('returns the base-asset (ETH) icon for the native-asset sentinel', async () => {
      const result = await resolvers.zapper(NATIVE_ASSET_ADDRESS, '');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'zapper-native-asset'
      });
    }, 30e3);
  });
});
