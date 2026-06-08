// The resolver reads the API key at module load and bails early without it, so
// the key must be set before the resolver module is imported below.
process.env.COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || 'test-key';

import sharp from 'sharp';
import resolve from '../../../src/resolvers/coingecko';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// coingecko first hits the CoinGecko API (global fetch) for token metadata,
// then fetches the image URL via the shared fetchHttpImage seam. Mock both so
// no network call is made; assert the deterministic sharp resize output.
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

const fixture = remoteResolverFixtures.coingecko;

describe('resolvers', () => {
  describe('coingecko pixel snapshot', () => {
    beforeEach(() => {
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ image: { large: fixture.metadataImageUrl } })
      }) as unknown as typeof fetch;
    });

    it('resizes the fetched token image deterministically', async () => {
      const result = await resolve(fixture.input.address, fixture.input.chainId);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'coingecko-resize'
      });
    });
  });
});
