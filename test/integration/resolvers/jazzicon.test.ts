import testResolverImageSnapshots from './helper';
import { jazziconSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'jazzicon',
  snapshotAddresses: {
    addresses: jazziconSnapshotAddresses
  }
});
