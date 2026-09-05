import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'defillama',
  withAvatar: [
    { args: [remoteSnapshotInputs.defillama.address, remoteSnapshotInputs.defillama.chainId] }
  ],
  withoutAvatar: [
    { args: [remoteSnapshotInputs.defillama.address, '999999'] },
    { args: [NO_AVATAR_ADDRESS, '1'] }
  ]
});
