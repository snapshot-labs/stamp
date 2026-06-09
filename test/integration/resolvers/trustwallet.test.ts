import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, remoteSnapshotInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'trustwallet',
  withAvatar: [
    {
      args: [remoteSnapshotInputs.trustwallet.address, remoteSnapshotInputs.trustwallet.chainId],
      id: 'trustwallet'
    }
  ],
  withoutAvatar: [{ args: [NO_AVATAR_ADDRESS, ''] }]
});
