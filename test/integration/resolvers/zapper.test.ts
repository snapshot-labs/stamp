import testResolverImageSnapshots from './helper';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

const { address, chainId } = remoteSnapshotInputs.zapper;

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
      description: 'resolves and matches the reference icon',
      args: [address, chainId],
      identifier: 'zapper',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'returns the base-asset (ETH) icon for the native-asset sentinel',
      args: [NATIVE_ASSET_ADDRESS, ''],
      identifier: 'zapper-native-asset',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
