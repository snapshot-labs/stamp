import testResolverImageSnapshots from './helper';
import { jazziconSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'jazzicon',
  snapshotCases: jazziconSnapshotAddresses.map(address => ({
    description: `renders a deterministic identicon matching the reference for ${address}`,
    args: [address],
    identifier: `jazzicon-${address}`
  }))
});
