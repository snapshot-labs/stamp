import resolvers from '../../../src/resolvers';
import {
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotOptions,
  STARKNET_ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  describe('starknet', () => {
    jest.retryTimes(3);

    it('should return false if missing', async () => {
      const result = await resolvers.starknet(noAvatarInputs.starknetMissing);

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers.starknet(STARKNET_ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    describe('with a simple image', () => {
      it('resolves with address and matches the reference', async () => {
        const result = await resolvers.starknet(realAvatarInputs.starknetSimpleAddress);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-simple'
        });
      }, 30e3);
    });

    describe('with the default image (starknet.id default identicon, rejected)', () => {
      it('should return false', async () => {
        const result = await resolvers.starknet(noAvatarInputs.starknetDefaultIdenticon);

        expect(result).toBe(false);
      });
    });

    describe('with an NFT image', () => {
      it('resolves with handle and matches the reference', async () => {
        const result = await resolvers.starknet(realAvatarInputs.starknetNftHandle);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-nft-handle'
        });
      }, 30e3);

      it('resolves with address and matches the reference', async () => {
        const result = await resolvers.starknet(realAvatarInputs.starknetNftAddress);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'starknet-nft-address'
        });
      }, 30e3);
    });
  });
});
