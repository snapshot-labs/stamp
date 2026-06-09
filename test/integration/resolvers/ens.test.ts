import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'ens',
  retryTimes: 3,
  withAvatar: [remoteSnapshotInputs.ens],
  withoutAvatar: [noAvatarInputs.ensAvatarNotSet, NO_AVATAR_ADDRESS, noAvatarInputs.ensInvalidName]
});
