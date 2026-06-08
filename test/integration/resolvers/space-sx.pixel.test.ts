import sharp from 'sharp';
import { resolveAvatar } from '../../../src/resolvers/space-sx';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { graphQlCall } from '../../../src/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// space-sx resolveAvatar resolves the avatar value via a GraphQL call
// (src/utils.graphQlCall), then fetches the image via the shared fetchHttpImage
// seam. Mock graphQlCall and the fetch so no network call is made; assert the
// deterministic sharp resize output.
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

jest.mock('../../../src/utils', () => ({
  ...jest.requireActual('../../../src/utils'),
  graphQlCall: jest.fn()
}));

const fixture = remoteResolverFixtures.spaceSx;

describe('resolvers', () => {
  describe('space-sx avatar pixel snapshot', () => {
    beforeEach(() => {
      (graphQlCall as jest.Mock).mockResolvedValue({
        data: { data: { spaces: [{ metadata: { avatar: fixture.avatarValue } }] } }
      });
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
    });

    it('resizes the fetched space avatar deterministically', async () => {
      const result = await resolveAvatar(fixture.input.key);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'space-sx-avatar-resize'
      });
    });
  });
});
