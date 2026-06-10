import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'farcaster',
  requireEnv: ['NEYNAR_API_KEY'],
  withAvatar: [remoteSnapshotInputs.farcaster],
  withoutAvatar: [
    noAvatarInputs.farcasterInvalidAddress,
    noAvatarInputs.farcasterNoAccount,
    NO_AVATAR_ADDRESS
  ]
});
