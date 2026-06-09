import resolvers from '../../../src/resolvers';
import { NO_AVATAR_ADDRESS, noAvatarInputs } from '../../fixtures/image-snapshot-addresses';

describe.skip('resolvers', () => {
  describe('selfid', () => {
    it('should return false if missing DID', async () => {
      const result = await resolvers.selfid(noAvatarInputs.selfidMissingDid);

      expect(result).toBe(false);
    });

    it('should return false if has no avatar', async () => {
      const result = await resolvers.selfid(noAvatarInputs.selfidNoAvatar);

      expect(result).toBe(false);
    });

    it('returns false for a normal address with no avatar', async () => {
      const result = await resolvers.selfid(NO_AVATAR_ADDRESS);

      expect(result).toBe(false);
    });

    it.todo('resolves and matches the reference avatar (Ceramic gateway deprecated)');
  });
});
