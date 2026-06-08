import sharp from 'sharp';
import { getAvatar } from '../../../src/addressResolvers/basename';
import resolve from '../../../src/resolvers/basename';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// basename resolves the avatar URL via addressResolvers/basename.getAvatar,
// then fetches the image via the shared fetchHttpImage seam. Mock both so no
// network call is made; assert the deterministic sharp resize output.
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

jest.mock('../../../src/addressResolvers/basename', () => ({
  getAvatar: jest.fn()
}));

const fixture = remoteResolverFixtures.basename;

describe('resolvers', () => {
  describe('basename pixel snapshot', () => {
    beforeEach(() => {
      (getAvatar as jest.Mock).mockResolvedValue(fixture.avatarUrl);
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
    });

    it('resizes the fetched avatar deterministically', async () => {
      const result = await resolve(fixture.input.nameOrAddress);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'basename-resize'
      });
    });
  });
});
