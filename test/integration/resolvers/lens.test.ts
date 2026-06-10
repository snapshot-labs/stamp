import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'lens',
  withAvatar: [remoteSnapshotInputs.lens, realAvatarInputs.lensByAddress],
  withoutAvatar: [
    noAvatarInputs.lensMissing,
    noAvatarInputs.lensInvalidAddress,
    noAvatarInputs.lensNonExistentDomain,
    NO_AVATAR_ADDRESS
  ]
});
