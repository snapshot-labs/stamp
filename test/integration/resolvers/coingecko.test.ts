import resolvers from '../../../src/resolvers';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs,
  remoteSnapshotOptions
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

      // No-avatar path: a normal, non-special mainnet address with no CoinGecko
      // token entry. coingecko has no default fallback image, so it returns
      // false. (The zero address is avoided here: some providers special-case it
      // to the native asset, which would not exercise the real no-avatar path.)
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
