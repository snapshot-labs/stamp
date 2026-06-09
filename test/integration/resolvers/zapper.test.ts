import testResolverImageSnapshots from './helper';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'zapper',
  falseCases: [
    {
      description: 'returns false for a normal address with no token icon',
      args: [NO_AVATAR_ADDRESS, '']
    }
  ],
  snapshotCases: [
    {
      args: [remoteSnapshotInputs.zapper.address, remoteSnapshotInputs.zapper.chainId],
      identifier: 'zapper',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [NATIVE_ASSET_ADDRESS, ''],
      identifier: 'zapper-native-asset',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
