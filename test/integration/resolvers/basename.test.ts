import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

jest.retryTimes(3);

testResolverImageSnapshots({
  name: 'basename',
  snapshotCases: [
    {
      description: 'resolves an avatar by basename and matches the reference',
      args: [remoteSnapshotInputs.basename],
      identifier: 'basename',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves an avatar by address and matches the reference',
      args: [realAvatarInputs.basenameByAddress],
      identifier: 'basename-by-address',
      tolerant: true,
      timeout: 30e3
    }
  ],
  falseCases: [
    {
      description: 'returns false for a normal address with no avatar',
      args: [NO_AVATAR_ADDRESS],
      timeout: 30e3
    },
    {
      description: 'should return false for an address without a basename',
      args: [noAvatarInputs.basenameNoName],
      timeout: 30e3
    },
    {
      description: 'should return false for a non-basename input',
      args: [noAvatarInputs.basenameNonBasenameInput],
      timeout: 10e3
    }
  ]
});
