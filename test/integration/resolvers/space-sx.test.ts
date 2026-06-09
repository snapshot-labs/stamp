import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  realAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'space-sx',
  withAvatar: [
    { args: [remoteSnapshotInputs.spaceSxArbitrum], id: 'space-sx-avatar' },
    { args: [realAvatarInputs.spaceSxOptimism], id: 'space-sx-optimism' },
    { args: [realAvatarInputs.spaceSxStarknet], id: 'space-sx-starknet' },
    { args: [realAvatarInputs.spaceSxStarknetSepolia], id: 'space-sx-starknet-sepolia' },
    { args: [realAvatarInputs.spaceSxSepolia], id: 'space-sx-sepolia' }
  ],
  withoutAvatar: [
    noAvatarInputs.spaceSxMissing,
    NO_AVATAR_ADDRESS,
    noAvatarInputs.spaceSxInvalidAddress
  ],
  todoCases: ['should resolve on eth']
});
