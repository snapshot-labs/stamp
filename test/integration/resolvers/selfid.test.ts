import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, noAvatarInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'selfid',
  skip: true,
  withoutAvatar: [
    noAvatarInputs.selfidMissingDid,
    noAvatarInputs.selfidNoAvatar,
    NO_AVATAR_ADDRESS
  ],
  todoCases: ['resolves and matches the reference avatar (Ceramic gateway deprecated)']
});
