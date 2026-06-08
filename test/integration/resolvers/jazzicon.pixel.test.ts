import sharp from 'sharp';
import resolvers from '../../../src/resolvers';
import { jazziconSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

describe('resolvers', () => {
  describe('jazzicon pixel snapshot', () => {
    it.each(jazziconSnapshotAddresses)(
      'renders a deterministic identicon matching the reference for %s',
      async address => {
        const result = await resolvers.jazzicon(address);

        expect(result).toBeInstanceOf(Buffer);
        // Resolver output is WebP; jest-image-snapshot needs a PNG buffer.
        const png = await sharp(result as Buffer)
          .png()
          .toBuffer();
        expect(png).toMatchImageSnapshot({
          customSnapshotIdentifier: `jazzicon-${address}`
        });
      }
    );
  });
});
