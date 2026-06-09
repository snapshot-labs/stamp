import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'farcaster',
  requireEnv: ['NEYNAR_API_KEY'],
  falseCases: [
    {
      description: 'should return false for invalid address',
      args: [noAvatarInputs.farcasterInvalidAddress]
    },
    {
      description: 'should return false for address without farcaster account',
      args: [noAvatarInputs.farcasterNoAccount]
    },
    {
      description: 'returns false for a normal address with no farcaster account',
      args: [NO_AVATAR_ADDRESS]
    }
  ],
  snapshotCases: [
    {
      args: [remoteSnapshotInputs.farcaster],
      identifier: 'farcaster',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
