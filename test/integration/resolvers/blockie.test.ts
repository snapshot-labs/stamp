import testResolverImageSnapshots from './helper';
import { blockieSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'blockie',
  snapshotAddresses: {
    addresses: blockieSnapshotAddresses,
    description: address =>
      `renders a deterministic identicon matching the reference for ${address}`
  }
});
