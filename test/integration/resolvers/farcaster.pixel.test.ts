import fetch from 'node-fetch';
import sharp from 'sharp';
import resolve from '../../../src/resolvers/farcaster';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// farcaster first resolves the address -> pfp URL via Neynar (node-fetch),
// then fetches the image via the shared fetchHttpImage seam. Mock both so no
// network call is made; assert the deterministic sharp resize output.
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

jest.mock('node-fetch', () => jest.fn());

const fixture = remoteResolverFixtures.farcaster;

describe('resolvers', () => {
  describe('farcaster pixel snapshot', () => {
    beforeEach(() => {
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
      (fetch as unknown as jest.Mock).mockResolvedValue({
        ok: true,
        url: 'https://api.neynar.com',
        status: 200,
        json: async () => ({
          [fixture.input.address.toLowerCase()]: [{ pfp_url: fixture.pfpUrl }]
        })
      });
    });

    it('resizes the fetched profile image deterministically', async () => {
      const result = await resolve(fixture.input.address);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'farcaster-resize'
      });
    });
  });
});
