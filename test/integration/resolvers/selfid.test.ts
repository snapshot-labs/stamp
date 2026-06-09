import resolvers from '../../../src/resolvers';
import { NO_AVATAR_ADDRESS, noAvatarInputs } from '../../fixtures/image-snapshot-addresses';

// selfid resolves a Ceramic basicProfile image for REAL. The whole suite is
// skipped because the Ceramic gateway is effectively deprecated, so the
// real-avatar image snapshot is left as it.todo (no baseline can be minted
// against a dead upstream). The fallback path (no DID / no avatar / a
// normal address) returns false: selfid has no default fallback image.
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

    // Real-avatar image snapshot pending: Ceramic gateway is deprecated, so no
    // stable baseline can be minted. Tracked as a todo rather than a Buffer-size
    // assertion.
    it.todo('resolves and matches the reference avatar (Ceramic gateway deprecated)');
  });
});
