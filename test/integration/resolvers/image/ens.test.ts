import testResolverImageSnapshots from './helper';
import resolve from '../../../../src/resolvers/image/ens';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'ens',
  withAvatar: [remoteSnapshotInputs.ens],
  withoutAvatar: [noAvatarInputs.ensAvatarNotSet, NO_AVATAR_ADDRESS, noAvatarInputs.ensInvalidName]
});

it('resolves a .base.eth avatar served only through ENS', async () => {
  await expect(resolve('mint.base.eth')).resolves.toBeInstanceOf(Buffer);
}, 30e3);
