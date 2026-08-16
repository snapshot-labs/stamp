import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  remoteSnapshotInputs
} from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'coingecko',
  requireEnv: ['COINGECKO_API_KEY'],
  withAvatar: [
    { args: [remoteSnapshotInputs.coingecko.address, remoteSnapshotInputs.coingecko.chainId] }
  ],
  withoutAvatar: [
    { args: [remoteSnapshotInputs.coingecko.address, '999999'] },
    { args: [NO_AVATAR_ADDRESS, '1'] }
  ]
});
