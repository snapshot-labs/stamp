import testResolverImageSnapshots from './helper';
import { blockieSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'blockie',
  snapshotAddresses: {
    addresses: blockieSnapshotAddresses
  }
});
