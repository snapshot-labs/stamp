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
      description: 'resolves on arbitrum and matches the reference avatar',
      args: [remoteSnapshotInputs.spaceSxArbitrum],
      identifier: 'space-sx-avatar',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves on optimism and matches the reference avatar',
      args: [realAvatarInputs.spaceSxOptimism],
      identifier: 'space-sx-optimism',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves on starknet and matches the reference avatar',
      args: [realAvatarInputs.spaceSxStarknet],
      identifier: 'space-sx-starknet',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves on starknet sepolia and matches the reference avatar',
      args: [realAvatarInputs.spaceSxStarknetSepolia],
      identifier: 'space-sx-starknet-sepolia',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves on sepolia and matches the reference avatar',
      args: [realAvatarInputs.spaceSxSepolia],
      identifier: 'space-sx-sepolia',
      tolerant: true,
      timeout: 30e3
    }
  ]
});

describe('resolvers', () => {
  describe('space-sx', () => {
    it.todo('should resolve on eth');
  });
});
