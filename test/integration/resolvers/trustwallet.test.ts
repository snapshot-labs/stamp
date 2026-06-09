import resolvers from '../../../src/resolvers';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  describe('trustwallet', () => {
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

    it('returns the base-asset (ETH) icon for the native-asset sentinel', async () => {
      const result = await resolvers.trustwallet(NATIVE_ASSET_ADDRESS, '');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'trustwallet-native-asset'
      });
    }, 30e3);
  });
});
