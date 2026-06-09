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
    remoteSnapshotInputs.spaceSxArbitrum,
    realAvatarInputs.spaceSxOptimism,
    realAvatarInputs.spaceSxStarknet,
    realAvatarInputs.spaceSxStarknetSepolia,
    realAvatarInputs.spaceSxSepolia
  ],
  withoutAvatar: [
    noAvatarInputs.spaceSxMissing,
    NO_AVATAR_ADDRESS,
    noAvatarInputs.spaceSxInvalidAddress
  ],
  todoCases: ['should resolve on eth']
});
