import resolvers from '../../../src/resolvers';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  describe('zapper', () => {
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

    it('returns the base-asset (ETH) icon for the native-asset sentinel', async () => {
      const result = await resolvers.zapper(NATIVE_ASSET_ADDRESS, '');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'zapper-native-asset'
      });
    }, 30e3);
  });
});
