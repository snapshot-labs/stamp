import testResolverImageSnapshots from './helper';
import { NO_AVATAR_ADDRESS, noAvatarInputs } from '../../fixtures/image-snapshot-addresses';

testResolverImageSnapshots({
  name: 'selfid',
  skip: true,
  falseCases: [
    { description: 'should return false if missing DID', args: [noAvatarInputs.selfidMissingDid] },
    { description: 'should return false if has no avatar', args: [noAvatarInputs.selfidNoAvatar] },
    {
      description: 'returns false for a normal address with no avatar',
      args: [NO_AVATAR_ADDRESS]
    }
  ]
});

describe.skip('resolvers', () => {
  describe('selfid', () => {
    it.todo('resolves and matches the reference avatar (Ceramic gateway deprecated)');
  });
});
