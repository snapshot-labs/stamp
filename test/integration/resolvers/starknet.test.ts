import testResolverImageSnapshots from './helper';
import {
  noAvatarInputs,
  realAvatarInputs,
  STARKNET_ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';

jest.retryTimes(3);

testResolverImageSnapshots({
  name: 'starknet',
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
      description: 'resolves a simple image with address and matches the reference',
      args: [realAvatarInputs.starknetSimpleAddress],
      identifier: 'starknet-simple',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves an NFT image with handle and matches the reference',
      args: [realAvatarInputs.starknetNftHandle],
      identifier: 'starknet-nft-handle',
      tolerant: true,
      timeout: 30e3
    },
    {
      description: 'resolves an NFT image with address and matches the reference',
      args: [realAvatarInputs.starknetNftAddress],
      identifier: 'starknet-nft-address',
      tolerant: true,
      timeout: 30e3
    }
  ]
});
