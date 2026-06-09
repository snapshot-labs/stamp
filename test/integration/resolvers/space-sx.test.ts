import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions,
  ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// space-sx resolves an sx-gov space avatar URL for REAL across several chains,
// fetches the image, then resizes/re-encodes via sharp. Every image-returning
// per-chain case asserts a TOLERANT image snapshot of the real output. The
// fallback path (no space / zero address) returns false: space-sx has no
// default fallback image.
describe('resolvers', () => {
  describe('space-sx', () => {
    describe('avatar', () => {
      it('should return false if missing', async () => {
        const result = await resolvers['space-sx']('0x06ba9855965EeEc09B5D43B113944c27F45aD3Ce');

        expect(result).toBe(false);
      });

      it('returns false for the zero address (no fallback image)', async () => {
        const result = await resolvers['space-sx'](ZERO_ADDRESS);

        expect(result).toBe(false);
      });

      it('should return false if address is invalid', async () => {
        const result = await resolvers['space-sx']('0x00006ba9855965EeEc09B5D43B113944c27F45aD3Ce');

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
        const result = await resolvers['space-sx']('0x2EF7E7CF469f5296011664682D58b57D38a3c83f');

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-optimism'
        });
      }, 30e3);

      it('resolves on starknet and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](
          '0x010841ba1d0c66602aa27837560823e631b19686ebbdcd591caa42a7c01611c0'
        );

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-starknet'
        });
      }, 30e3);

      it('resolves on starknet sepolia and matches the reference avatar', async () => {
        const result = await resolvers['space-sx'](
          '0x00a330d13703f0af4f87e65d95c898297f8ce6e88ac7e9bff3b3bd270d2f6d5b'
        );

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-starknet-sepolia'
        });
      }, 30e3);

      it('resolves on sepolia and matches the reference avatar', async () => {
        const result = await resolvers['space-sx']('0xbFF55fd2A671288316956A0Cae8f1d24BA7E5C9B');

        await expectResolverImageSnapshot(result, {
          ...remoteSnapshotOptions,
          customSnapshotIdentifier: 'space-sx-sepolia'
        });
      }, 30e3);
    });
  });
});
