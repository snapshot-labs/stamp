import testResolverImageSnapshots from './helper';
import {
  NATIVE_ASSET_ADDRESS,
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'trustwallet',
  falseCases: [
    {
      description: 'returns false for a normal address with no token logo',
      args: [NO_AVATAR_ADDRESS, '']
    }
  ],
  snapshotCases: [
    {
      description: 'resolves and matches the reference avatar',
      args: [remoteSnapshotInputs.trustwallet.address, remoteSnapshotInputs.trustwallet.chainId],
      identifier: 'trustwallet',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'returns the base-asset (ETH) icon for the native-asset sentinel',
      args: [NATIVE_ASSET_ADDRESS, ''],
      identifier: 'trustwallet-native-asset',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
