import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, remoteSnapshotInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'zapper',
  withAvatar: [
    { args: [remoteSnapshotInputs.zapper.address, remoteSnapshotInputs.zapper.chainId] }
  ],
  withoutAvatar: [{ args: [NO_AVATAR_ADDRESS, ''] }]
});
