import resolvers from '../../../src/resolvers';
import {
  remoteSnapshotInputs,
  remoteSnapshotOptions,
  ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// coingecko fetches token metadata from the CoinGecko Pro API for REAL (needs
// COINGECKO_API_KEY), then fetches and resizes the token image via sharp.
// CoinGecko token images are stable stored assets, so the positive case asserts
// a TOLERANT image snapshot of the real output.
describe('resolvers', () => {
  if (!process.env.COINGECKO_API_KEY) {
    it.todo('is missing COINGECKO_API_KEY');
  } else {
    describe('coingecko', () => {
      it('should return false on unsupported chain', async () => {
        const result = await resolvers.coingecko(remoteSnapshotInputs.coingecko.address, '999999');

        expect(result).toBe(false);
      });

      // Fallback path: the zero address has no CoinGecko token entry, so
      // coingecko has no default fallback image and returns false.
      it('returns false for the zero address (no fallback image)', async () => {
        const result = await resolvers.coingecko(ZERO_ADDRESS, '1');

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
