import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions,
  ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// trustwallet fetches a token logo from the trustwallet/assets repo for REAL,
// then resizes/re-encodes it via sharp. The baseline is TOLERANT (small
// failureThreshold) to absorb benign upstream/CDN re-encodes.
describe('resolvers', () => {
  describe('trustwallet', () => {
    it('should return false if missing', async () => {
      const result = await resolvers.trustwallet('0x556B14CbdA79A36dC33FcD461a04A5BCb5dC2A70', '');

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

    // Fallback path: the zero address has no token logo, so trustwallet falls
    // back to the base-asset (ETH) icon. Snapshot that fallback image.
    it('falls back to the base-asset icon for the zero address', async () => {
      const result = await resolvers.trustwallet(ZERO_ADDRESS, '');

      await expectResolverImageSnapshot(result, {
        ...remoteSnapshotOptions,
        customSnapshotIdentifier: 'trustwallet-fallback'
      });
    }, 30e3);
  });
});
