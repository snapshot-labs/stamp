import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'trustwallet',
  withAvatar: [
    remoteSnapshotInputs.trustwallet.address,
    {
      args: [
        remoteSnapshotInputs.trustwalletBnb.address,
        remoteSnapshotInputs.trustwalletBnb.chainId
      ]
    },
    {
      args: [
        remoteSnapshotInputs.trustwalletCake.address,
        remoteSnapshotInputs.trustwalletCake.chainId
      ]
    }
  ],
  withoutAvatar: [NO_AVATAR_ADDRESS, { args: [NO_AVATAR_ADDRESS, '56'] }]
});
