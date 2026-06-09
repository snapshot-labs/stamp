import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'basename',
  retryTimes: 3,
  withAvatar: [
    { args: [remoteSnapshotInputs.basename], id: 'basename' },
    { args: [realAvatarInputs.basenameByAddress], id: 'basename-by-address' }
  ],
  withoutAvatar: [
    NO_AVATAR_ADDRESS,
    noAvatarInputs.basenameNoName,
    { args: [noAvatarInputs.basenameNonBasenameInput], timeout: 10e3 }
  ]
});
