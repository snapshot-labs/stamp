import testResolverImageSnapshots from './helper';
import { jazziconSnapshotAddresses } from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'jazzicon',
  withAvatar: [...jazziconSnapshotAddresses],
  snapshotOptions: { customDiffConfig: { threshold: 0.05 } }
});
