import testResolverImageSnapshots from './helper';
import { blockieSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'blockie',
  withAvatar: [...blockieSnapshotAddresses]
});
