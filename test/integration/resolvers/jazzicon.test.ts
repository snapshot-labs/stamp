import resolvers from '../../../src/resolvers';
import { jazziconSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// jazzicon is deterministic: the identicon is rendered purely from the address,
// so the baseline is an EXACT pixel match (within anti-aliasing tolerance from
// setup-jest).
describe('resolvers', () => {
  describe('jazzicon', () => {
    it.each(jazziconSnapshotAddresses)(
      'renders a deterministic identicon matching the reference for %s',
      async address => {
        const result = await resolvers.jazzicon(address);

        await expectResolverImageSnapshot(result, {
          customSnapshotIdentifier: `jazzicon-${address}`
        });
      }
    );
  });
});
