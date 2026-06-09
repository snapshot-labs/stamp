import testResolverImageSnapshots from './helper';
import {
  noAvatarInputs,
  realAvatarInputs,
  STARKNET_ZERO_ADDRESS
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'starknet',
  withAvatar: [
    realAvatarInputs.starknetSimpleAddress,
    realAvatarInputs.starknetNftHandle,
    realAvatarInputs.starknetNftAddress
  ],
  withoutAvatar: [
    noAvatarInputs.starknetMissing,
    STARKNET_ZERO_ADDRESS,
    noAvatarInputs.starknetDefaultIdenticon
  ]
});
