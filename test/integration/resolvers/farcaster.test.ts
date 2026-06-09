import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

if (!process.env.NEYNAR_API_KEY) {
  describe('resolvers', () => {
    it.todo('is missing NEYNAR_API_KEY');
  });
} else {
  testResolverImageSnapshots({
    name: 'farcaster',
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
        description: 'resolves and matches the reference avatar',
        args: [remoteSnapshotInputs.farcaster],
        identifier: 'farcaster',
        tolerant: true,
        timeout: 30e3
      }
    ]
  });
}
