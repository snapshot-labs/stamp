import sharp from 'sharp';
import resolve from '../../../src/resolvers/lens';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { graphQlCall } from '../../../src/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// lens resolves the picture URL via a GraphQL call (src/utils.graphQlCall),
// then fetches the image via the shared fetchHttpImage seam. Mock graphQlCall
// and the fetch so no network call is made; assert the deterministic sharp
// resize output.
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

jest.mock('../../../src/utils', () => ({
  ...jest.requireActual('../../../src/utils'),
  graphQlCall: jest.fn()
}));

const fixture = remoteResolverFixtures.lens;

describe('resolvers', () => {
  describe('lens pixel snapshot', () => {
    beforeEach(() => {
      (graphQlCall as jest.Mock).mockResolvedValue({
        data: { data: { account: { metadata: { picture: fixture.pictureUrl } } } }
      });
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
    });

    it('resizes the fetched picture deterministically', async () => {
      const result = await resolve(fixture.input.domainOrAddress);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'lens-resize'
      });
    });
  });
});
