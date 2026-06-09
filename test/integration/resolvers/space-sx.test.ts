import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'space-sx',
  describeName: 'space-sx',
  falseCases: [
    { description: 'should return false if missing', args: [noAvatarInputs.spaceSxMissing] },
    {
      description: 'returns false for a normal address with no avatar',
      args: [NO_AVATAR_ADDRESS]
    },
    {
      description: 'should return false if address is invalid',
      args: [noAvatarInputs.spaceSxInvalidAddress]
    }
  ],
  snapshotCases: [
    {
      args: [remoteSnapshotInputs.spaceSxArbitrum],
      identifier: 'space-sx-avatar',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [realAvatarInputs.spaceSxOptimism],
      identifier: 'space-sx-optimism',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [realAvatarInputs.spaceSxStarknet],
      identifier: 'space-sx-starknet',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [realAvatarInputs.spaceSxStarknetSepolia],
      identifier: 'space-sx-starknet-sepolia',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [realAvatarInputs.spaceSxSepolia],
      identifier: 'space-sx-sepolia',
      tolerant: true,
      timeout: 30e3
    }
  ],
  todoCases: ['should resolve on eth']
});
