import testResolverImageSnapshots from './helper';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'trustwallet',
  withAvatar: [
    {
      args: [remoteSnapshotInputs.trustwallet.address, remoteSnapshotInputs.trustwallet.chainId],
      id: 'trustwallet'
    },
    { args: [NATIVE_ASSET_ADDRESS, ''], id: 'trustwallet-native-asset' }
  ],
  withoutAvatar: [{ args: [NO_AVATAR_ADDRESS, ''] }]
});
