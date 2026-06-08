import resolvers from '../../../src/resolvers';
import { PIXEL_FIXTURE_ADDRESSES } from '../../helpers/fixture-addresses';
import '../../helpers/pixel';

describe('resolvers', () => {
  describe('jazzicon pixel snapshot', () => {
    it.each(PIXEL_FIXTURE_ADDRESSES)(
      'renders a deterministic identicon matching the reference for %s',
      async address => {
        const result = await resolvers.jazzicon(address);

        expect(result).toBeInstanceOf(Buffer);
        await expect(result).toMatchImageSnapshot('jazzicon', address);
      }
    );
  });
});
