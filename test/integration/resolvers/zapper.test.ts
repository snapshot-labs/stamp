import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, remoteSnapshotInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'zapper',
  withAvatar: [remoteSnapshotInputs.zapper.address],
  withoutAvatar: [NO_AVATAR_ADDRESS]
});
