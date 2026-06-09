import resolvers from '../../../src/resolvers';
import { blockieSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';
import { expectResolverImageSnapshot } from '../../helpers/imageSnapshot';

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
