import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

describe('resolvers', () => {
  if (!process.env.COINGECKO_API_KEY) {
    it.todo('is missing COINGECKO_API_KEY');
  } else {
    describe('coingecko', () => {
      it('should return false on unsupported chain', async () => {
        const result = await resolvers.coingecko(remoteSnapshotInputs.coingecko.address, '999999');

        expect(result).toBe(false);
      });

      it('returns false for a normal address with no token entry', async () => {
        const result = await resolvers.coingecko(NO_AVATAR_ADDRESS, '1');

        expect(result).toBe(false);
      }, 30e3);

      it('resolves and matches the reference icon', async () => {
        const { address, chainId } = remoteSnapshotInputs.coingecko;
        const result = await resolvers.coingecko(address, chainId);

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'coingecko'
        });
      }, 30e3);
    });
  }
});
