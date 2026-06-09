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
      id: 'on user avatar',
      withAvatar: [
        { args: [remoteSnapshotInputs.snapshotUserAvatar, 1, 'eth'], id: 'snapshot-user-avatar' }
      ],
      withoutAvatar: [noAvatarInputs.snapshotUserMissing, NO_AVATAR_ADDRESS]
    },
    {
      resolver: 'user-cover',
      id: 'on user cover',
      withAvatar: [
        { args: [remoteSnapshotInputs.snapshotUserCover, 1, 'eth'], id: 'snapshot-user-cover' }
      ],
      withoutAvatar: [noAvatarInputs.snapshotUserMissing, NO_AVATAR_ADDRESS]
    },
    {
      resolver: 'space',
      id: 'on space avatar',
      withAvatar: [
        { args: [remoteSnapshotInputs.snapshotSpaceAvatar], id: 'snapshot-space-avatar' }
      ],
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
      id: 'on space cover',
      withAvatar: [{ args: [remoteSnapshotInputs.snapshotSpaceCover], id: 'snapshot-space-cover' }],
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
