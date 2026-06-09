import testResolverImageSnapshots from './helper';
import {
  NO_AVATAR_ADDRESS,
  noAvatarInputs,
  remoteSnapshotInputs
} from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'snapshot',
  groups: [
    {
      resolver: 'snapshot',
      describeName: 'on user avatar',
      falseCases: [
        {
          description: 'should return false if missing',
          args: [noAvatarInputs.snapshotUserMissing]
        },
        {
          description: 'returns false for a normal address with no avatar',
          args: [NO_AVATAR_ADDRESS]
        }
      ],
      snapshotCases: [
        {
          description: 'resolves regardless of network and matches the reference avatar',
          args: [remoteSnapshotInputs.snapshotUserAvatar, 1, 'eth'],
          identifier: 'snapshot-user-avatar',
          tolerant: true,
          timeout: 30e3
        }
      ]
    },
    {
      resolver: 'user-cover',
      describeName: 'on user cover',
      falseCases: [
        {
          description: 'should return false if missing',
          args: [noAvatarInputs.snapshotUserMissing]
        },
        {
          description: 'returns false for a normal address with no avatar',
          args: [NO_AVATAR_ADDRESS]
        }
      ],
      snapshotCases: [
        {
          description: 'resolves regardless of network and matches the reference cover',
          args: [remoteSnapshotInputs.snapshotUserCover, 1, 'eth'],
          identifier: 'snapshot-user-cover',
          tolerant: true,
          timeout: 30e3
        }
      ]
    },
    {
      resolver: 'space',
      describeName: 'on space avatar',
      falseCases: [
        {
          description: 'should return false if missing',
          args: [noAvatarInputs.snapshotSpaceMissing]
        },
        {
          description: 'returns false for a normal address with no avatar',
          args: [NO_AVATAR_ADDRESS]
        },
        {
          description: 'should return false on unsupported network',
          args: [noAvatarInputs.snapshotSpaceUnsupportedNetwork, 1, 'eth']
        }
      ],
      snapshotCases: [
        {
          description: 'resolves and matches the reference avatar',
          args: [remoteSnapshotInputs.snapshotSpaceAvatar],
          identifier: 'snapshot-space-avatar',
          tolerant: true,
          timeout: 30e3
        }
      ],
      legacyEqualityCases: [
        {
          description: 'should return same result for both legacy and non-legacy format',
          args: [remoteSnapshotInputs.snapshotSpaceAvatar],
          legacyArgs: [remoteSnapshotInputs.snapshotSpaceAvatar, 1, 's']
        }
      ]
    },
    {
      resolver: 'space-cover',
      describeName: 'on space cover',
      falseCases: [
        {
          description: 'should return false if missing',
          args: [noAvatarInputs.snapshotSpaceMissing]
        },
        {
          description: 'returns false for a normal address with no avatar',
          args: [NO_AVATAR_ADDRESS]
        },
        {
          description: 'should return false on unsupported network',
          args: [remoteSnapshotInputs.snapshotSpaceCover, 1, 'eth']
        }
      ],
      snapshotCases: [
        {
          description: 'resolves and matches the reference cover',
          args: [remoteSnapshotInputs.snapshotSpaceCover],
          identifier: 'snapshot-space-cover',
          tolerant: true,
          timeout: 30e3
        }
      ],
      legacyEqualityCases: [
        {
          description: 'should return same result for both legacy and non-legacy format',
          args: [remoteSnapshotInputs.snapshotSpaceCover],
          legacyArgs: [remoteSnapshotInputs.snapshotSpaceCover, 1, 's']
        }
      ]
    }
  ]
});
