import sharp from 'sharp';
import resolve from '../../../src/resolvers/trustwallet';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// Mock the shared image-fetch seam so no network call is made. The resolver
// builds the remote URL purely from its arguments; we only need to feed it a
// committed source image and then assert the deterministic sharp resize output.
// jest.mock is hoisted above the imports above, so the resolver sees the mock.
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

const fixture = remoteResolverFixtures.trustwallet;

describe('resolvers', () => {
  describe('trustwallet pixel snapshot', () => {
    beforeEach(() => {
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
    });

    it('resizes the fetched image deterministically', async () => {
      const result = await resolve(fixture.input.address, fixture.input.chainId);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'trustwallet-resize'
      });
    });
  });
});
