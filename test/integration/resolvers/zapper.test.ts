import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// zapper fetches a token icon from zapper's CDN for REAL, then resizes/
// re-encodes it via sharp. The baseline is TOLERANT to absorb CDN re-encodes.
describe('resolvers', () => {
  describe('zapper', () => {
    it('should return false if missing', async () => {
      const result = await resolvers.zapper('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70', '');

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
  });
});
