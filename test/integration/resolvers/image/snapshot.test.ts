import testResolverImageSnapshots from './helper';
import { resolveSpaceAvatar } from '../../../../src/resolvers/image/snapshot';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'snapshot',
  resolver: 'snapshot',
  subId: 'snapshot-user-avatar',
  withAvatar: [
    { args: [remoteSnapshotInputs.snapshotUserAvatar, 1, 'eth'] },
    { args: [remoteSnapshotInputs.snapshotUserAvatarLowercase, 1, 'eth'] }
  ],
  withoutAvatar: [noAvatarInputs.snapshotUserMissing, NO_AVATAR_ADDRESS]
});

testResolverImageSnapshots({
  id: 'snapshot',
  resolver: 'user-cover',
  subId: 'snapshot-user-cover',
  withAvatar: [{ args: [remoteSnapshotInputs.snapshotUserCover, 1, 'eth'] }],
  withoutAvatar: [noAvatarInputs.snapshotUserMissing, NO_AVATAR_ADDRESS]
});

testResolverImageSnapshots({
  id: 'snapshot',
  resolver: 'space',
  subId: 'snapshot-space-avatar',
  withAvatar: [remoteSnapshotInputs.snapshotSpaceAvatar],
  withoutAvatar: [
    noAvatarInputs.snapshotSpaceMissing,
    NO_AVATAR_ADDRESS,
    { args: [noAvatarInputs.snapshotSpaceUnsupportedNetwork, 1, 'eth'] }
  ]
});

// The registered resolver turns a throw into false, so only the raw one shows
// whether the space still fails upstream.
describe('snapshot space with an empty metadata link', () => {
  it('returns false instead of throwing', async () => {
    await expect(
      resolveSpaceAvatar(noAvatarInputs.snapshotSpaceEmptyMetadata, 1, 'eth')
    ).resolves.toBe(false);
  }, 30e3);
});

testResolverImageSnapshots({
  id: 'snapshot',
  resolver: 'space-cover',
  subId: 'snapshot-space-cover',
  withAvatar: [remoteSnapshotInputs.snapshotSpaceCover],
  withoutAvatar: [
    noAvatarInputs.snapshotSpaceMissing,
    NO_AVATAR_ADDRESS,
    { args: [remoteSnapshotInputs.snapshotSpaceCover, 1, 'eth'] }
  ]
});
