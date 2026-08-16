import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'basename',
  withAvatar: [remoteSnapshotInputs.basename, realAvatarInputs.basenameByAddress],
  withoutAvatar: [
    NO_AVATAR_ADDRESS,
    noAvatarInputs.basenameNoName,
    noAvatarInputs.basenameNonBasenameInput
  ]
});
