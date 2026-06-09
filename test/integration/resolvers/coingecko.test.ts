import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, remoteSnapshotInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'coingecko',
  requireEnv: ['COINGECKO_API_KEY'],
  falseCases: [
    {
      description: 'should return false on unsupported chain',
      args: [remoteSnapshotInputs.coingecko.address, '999999']
    },
    {
      description: 'returns false for a normal address with no token entry',
      args: [NO_AVATAR_ADDRESS, '1'],
      timeout: 30e3
    }
  ],
  snapshotCases: [
    {
      description: 'resolves and matches the reference icon',
      args: [remoteSnapshotInputs.coingecko.address, remoteSnapshotInputs.coingecko.chainId],
      identifier: 'coingecko',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
