import testResolverImageSnapshots from './helper';
import {
  noAvatarInputs,
  realAvatarInputs,
  STARKNET_ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'starknet',
  retryTimes: 3,
  withAvatar: [
    { args: [realAvatarInputs.starknetSimpleAddress], id: 'starknet-simple' },
    { args: [realAvatarInputs.starknetNftHandle], id: 'starknet-nft-handle' },
    { args: [realAvatarInputs.starknetNftAddress], id: 'starknet-nft-address' }
  ],
  withoutAvatar: [
    noAvatarInputs.starknetMissing,
    STARKNET_ZERO_ADDRESS,
    noAvatarInputs.starknetDefaultIdenticon
  ]
});
