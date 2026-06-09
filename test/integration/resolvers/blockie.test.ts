import testResolverImageSnapshots from './helper';
import { blockieSnapshotAddresses } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'blockie',
  snapshotCases: blockieSnapshotAddresses.map(address => ({
    description: `renders a deterministic identicon matching the reference for ${address}`,
    args: [address],
    identifier: `blockie-${address}`
  }))
});
