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
  describe('space-sx', () => {
    describe('avatar', () => {
      it('should return false if missing', async () => {
        const result = await resolvers['space-sx'](noAvatarInputs.spaceSxMissing);

        expect(result).toBe(false);
      });

      it('returns false for a normal address with no avatar', async () => {
        const result = await resolvers['space-sx'](NO_AVATAR_ADDRESS);

        expect(result).toBe(false);
      });

      it('should return false if address is invalid', async () => {
        const result = await resolvers['space-sx'](noAvatarInputs.spaceSxInvalidAddress);

        expect(result).toBe(false);
      });

      it.todo('should resolve on eth');

      it('resolves on arbitrum and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](remoteSnapshotInputs.spaceSxArbitrum);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-avatar'
        });
      }, 30e3);

      it('resolves on optimism and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](realAvatarInputs.spaceSxOptimism);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-optimism'
        });
      }, 30e3);

      it('resolves on starknet and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](realAvatarInputs.spaceSxStarknet);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-starknet'
        });
      }, 30e3);

      it('resolves on starknet sepolia and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](realAvatarInputs.spaceSxStarknetSepolia);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-starknet-sepolia'
        });
      }, 30e3);

      it('resolves on sepolia and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](realAvatarInputs.spaceSxSepolia);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-sepolia'
        });
      }, 30e3);
    });
  });
});
