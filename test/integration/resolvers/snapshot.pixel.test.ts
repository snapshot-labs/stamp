import sharp from 'sharp';
import { resolveUserAvatar } from '../../../src/resolvers/snapshot';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { graphQlCall } from '../../../src/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// snapshot resolveUserAvatar resolves the avatar value via a GraphQL call
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

const fixture = remoteResolverFixtures.snapshot;

describe('resolvers', () => {
  describe('snapshot user-avatar pixel snapshot', () => {
    beforeEach(() => {
      (graphQlCall as jest.Mock).mockResolvedValue({
        data: { data: { entry: { avatar: fixture.avatarValue } } }
      });
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
    });

    it('resizes the fetched user avatar deterministically', async () => {
      const result = await resolveUserAvatar(fixture.input.address);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'snapshot-user-avatar-resize'
      });
    });
  });
});
