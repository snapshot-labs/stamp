import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

jest.retryTimes(3);

testResolverImageSnapshots({
  name: 'ens',
  falseCases: [
    {
      description: 'should return false if avatar is not set',
      args: [noAvatarInputs.ensAvatarNotSet]
    },
    {
      description: 'returns false for a normal address with no avatar',
      args: [NO_AVATAR_ADDRESS],
      timeout: 10e3
    },
    {
      description: 'should return false on invalid ENS name',
      args: [noAvatarInputs.ensInvalidName],
      timeout: 10e3
    }
  ],
  snapshotCases: [
    {
      description: 'resolves and matches the reference avatar',
      args: [remoteSnapshotInputs.ens],
      identifier: 'ens',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
