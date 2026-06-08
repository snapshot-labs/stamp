import resolvers from '../../../src/resolvers';
import { blockieSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

// blockie is deterministic: the identicon is rendered purely from the address,
// so the baseline is an EXACT pixel match (within anti-aliasing tolerance from
// setup-jest).
describe('resolvers', () => {
  describe('blockie', () => {
    it.each(blockieSnapshotAddresses)(
      'renders a deterministic identicon matching the reference for %s',
      async address => {
        const result = await resolvers.blockie(address);

        await expectResolverImageSnapshot(result, {
          customSnapshotIdentifier: `blockie-${address}`
        });
      }
    );
  });
});
