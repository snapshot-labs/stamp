import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, remoteSnapshotInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'trustwallet',
  withAvatar: [remoteSnapshotInputs.trustwallet.address],
  withoutAvatar: [{ args: [NO_AVATAR_ADDRESS, ''] }]
});
