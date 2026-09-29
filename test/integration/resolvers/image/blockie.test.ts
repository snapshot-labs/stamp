import testResolverImageSnapshots from './helper';
import { blockieSnapshotAddresses } from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'blockie',
  withAvatar: [...blockieSnapshotAddresses],
  snapshotOptions: { customDiffConfig: { threshold: 0.05 } }
});
