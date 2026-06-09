import testResolverImageSnapshots from './helper';
import {
  noAvatarInputs,
  realAvatarInputs,
  STARKNET_ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'starknet',
  retryTimes: 3,
  falseCases: [
    { description: 'should return false if missing', args: [noAvatarInputs.starknetMissing] },
    {
      description: 'returns false for the zero address (no fallback image)',
      args: [STARKNET_ZERO_ADDRESS]
    },
    {
      description: 'returns false for the default starknet.id identicon',
      args: [noAvatarInputs.starknetDefaultIdenticon]
    }
  ],
  snapshotCases: [
    {
      args: [realAvatarInputs.starknetSimpleAddress],
      identifier: 'starknet-simple',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [realAvatarInputs.starknetNftHandle],
      identifier: 'starknet-nft-handle',
      tolerant: true,
      timeout: 30e3
    },
    {
      args: [realAvatarInputs.starknetNftAddress],
      identifier: 'starknet-nft-address',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
