import resolvers from '../../../src/resolvers';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// trustwallet fetches a token logo from the trustwallet/assets repo for REAL,
// then resizes/re-encodes it via sharp. The baseline is TOLERANT (small
// failureThreshold) to absorb benign upstream/CDN re-encodes.
describe('resolvers', () => {
  describe('trustwallet', () => {
    // No-avatar path: a normal, non-special address with no logo in the
    // trustwallet/assets repo. The upstream returns 404, the fetch throws, and
    // the resolver returns false. This is the genuine no-avatar result (the zero
    // address is NOT used here because it is special-cased, see below).
    it('returns false for a normal address with no token logo', async () => {
      const result = await resolvers.trustwallet(NO_AVATAR_ADDRESS, '');

      expect(result).toBe(false);
    });

    it('resolves and matches the reference avatar', async () => {
      const { address, chainId } = remoteSnapshotInputs.trustwallet;
      const result = await resolvers.trustwallet(address, chainId);

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'trustwallet'
      });
    }, 30e3);

    // Native-asset sentinel (SEPARATE from the no-avatar path): the zero address
    // is in the resolver's ETH list, so trustwallet special-cases it to the
    // base-asset (ETH) icon via getBaseAssetIconUrl. Snapshot that ETH image.
    it('returns the base-asset (ETH) icon for the native-asset sentinel', async () => {
      const result = await resolvers.trustwallet(NATIVE_ASSET_ADDRESS, '');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'trustwallet-native-asset'
      });
    }, 30e3);
  });
});
