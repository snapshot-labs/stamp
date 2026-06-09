import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'lens',
  falseCases: [
    { description: 'should return false if missing', args: [noAvatarInputs.lensMissing] },
    {
      description: 'should return false on invalid address',
      args: [noAvatarInputs.lensInvalidAddress]
    },
    {
      description: 'should return false on non-existent domain',
      args: [noAvatarInputs.lensNonExistentDomain]
    },
    {
      description: 'returns false for a normal address with no avatar',
      args: [NO_AVATAR_ADDRESS],
      timeout: 30e3
    }
  ],
  snapshotCases: [
    {
      description: 'resolves with handle and matches the reference avatar',
      args: [remoteSnapshotInputs.lens],
      identifier: 'lens',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves with address and matches the reference avatar',
      args: [realAvatarInputs.lensByAddress],
      identifier: 'lens-by-address',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
