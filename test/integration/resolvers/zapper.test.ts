import testResolverImageSnapshots from './helper';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'zapper',
  withAvatar: [
    {
      args: [remoteSnapshotInputs.zapper.address, remoteSnapshotInputs.zapper.chainId],
      id: 'zapper'
    },
    { args: [NATIVE_ASSET_ADDRESS, ''], id: 'zapper-native-asset' }
  ],
  withoutAvatar: [{ args: [NO_AVATAR_ADDRESS, ''] }]
});
