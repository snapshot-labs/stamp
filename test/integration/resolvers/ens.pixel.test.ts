import sharp from 'sharp';
import resolve from '../../../src/resolvers/ens';
import { fetchHttpImage } from '../../../src/resolvers/utils';
import { getProvider } from '../../../src/utils';
import { loadSampleAvatar, remoteResolverFixtures } from '../../fixtures/remote-resolver-fixtures';

// ens resolves an avatar text record via the ethers provider, then fetches the
// image via the shared fetchHttpImage seam. Mock the provider lookup and the
// fetch so no network call is made; assert the deterministic sharp resize
// output. A .eth name input keeps the resolver on the name branch (no reverse
// address lookup).
jest.mock('../../../src/resolvers/utils', () => ({
  ...jest.requireActual('../../../src/resolvers/utils'),
  fetchHttpImage: jest.fn()
}));

jest.mock('../../../src/utils', () => ({
  ...jest.requireActual('../../../src/utils'),
  getProvider: jest.fn()
}));

const fixture = remoteResolverFixtures.ens;

describe('resolvers', () => {
  describe('ens pixel snapshot', () => {
    beforeEach(() => {
      (getProvider as jest.Mock).mockReturnValue({
        getResolver: jest.fn().mockResolvedValue({
          getText: jest.fn().mockResolvedValue(fixture.avatarUrl)
        })
      });
      (fetchHttpImage as jest.Mock).mockResolvedValue(loadSampleAvatar());
    });

    it('resizes the fetched avatar deterministically', async () => {
      const result = await resolve(fixture.input.nameOrAddress);

      expect(result).toBeInstanceOf(Buffer);
      const png = await sharp(result as Buffer)
        .png()
        .toBuffer();
      expect(png).toMatchImageSnapshot({
        customSnapshotIdentifier: 'ens-resize'
      });
    });
  });
});
