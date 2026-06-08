import sharp from 'sharp';
import resolvers from '../../../src/resolvers';
import { PIXEL_FIXTURE_ADDRESSES } from '../../helpers/fixture-addresses';

describe('resolvers', () => {
  describe('blockie pixel snapshot', () => {
    it.each(PIXEL_FIXTURE_ADDRESSES)(
      'renders a deterministic identicon matching the reference for %s',
      async address => {
        const result = await resolvers.blockie(address);

        expect(result).toBeInstanceOf(Buffer);
        // Resolver output is WebP; jest-image-snapshot needs a PNG buffer.
        const png = await sharp(result as Buffer)
          .png()
          .toBuffer();
        expect(png).toMatchImageSnapshot({
          customSnapshotIdentifier: `blockie-${address}`
        });
      }
    );
  });
});
