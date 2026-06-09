import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  id: 'snapshot',
  groups: [
    {
      resolver: 'snapshot',
      id: 'snapshot-user-avatar',
      withAvatar: [{ args: [remoteSnapshotInputs.snapshotUserAvatar, 1, 'eth'] }],
      withoutAvatar: [noAvatarInputs.snapshotUserMissing, NO_AVATAR_ADDRESS]
    },
    {
      resolver: 'user-cover',
      id: 'snapshot-user-cover',
      withAvatar: [{ args: [remoteSnapshotInputs.snapshotUserCover, 1, 'eth'] }],
      withoutAvatar: [noAvatarInputs.snapshotUserMissing, NO_AVATAR_ADDRESS]
    },
    {
      resolver: 'space',
      id: 'snapshot-space-avatar',
      withAvatar: [{ args: [remoteSnapshotInputs.snapshotSpaceAvatar] }],
      withoutAvatar: [
        noAvatarInputs.snapshotSpaceMissing,
        NO_AVATAR_ADDRESS,
        { args: [noAvatarInputs.snapshotSpaceUnsupportedNetwork, 1, 'eth'] }
      ],
      legacyEqualityCases: [
        {
          args: [remoteSnapshotInputs.snapshotSpaceAvatar],
          legacyArgs: [remoteSnapshotInputs.snapshotSpaceAvatar, 1, 's']
        }
      ]
    },
    {
      resolver: 'space-cover',
      id: 'snapshot-space-cover',
      withAvatar: [{ args: [remoteSnapshotInputs.snapshotSpaceCover] }],
      withoutAvatar: [
        noAvatarInputs.snapshotSpaceMissing,
        NO_AVATAR_ADDRESS,
        { args: [remoteSnapshotInputs.snapshotSpaceCover, 1, 'eth'] }
      ],
      legacyEqualityCases: [
        {
          args: [remoteSnapshotInputs.snapshotSpaceCover],
          legacyArgs: [remoteSnapshotInputs.snapshotSpaceCover, 1, 's']
        }
      ]
    }
  ]
});
