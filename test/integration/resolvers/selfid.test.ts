import resolvers from '../../../src/resolvers';
import { ZERO_ADDRESS } from '../../fixtures/image-snapshot-addresses';

// selfid resolves a Ceramic basicProfile image for REAL. The whole suite is
// skipped because the Ceramic gateway is effectively deprecated, so the
// real-avatar image snapshot is left as it.todo (no baseline can be minted
// against a dead upstream). The fallback path (no DID / no avatar / zero
// address) returns false: selfid has no default fallback image.
describe.skip('resolvers', () => {
  describe('selfid', () => {
    it('should return false if missing DID', async () => {
      const result = await resolvers.selfid('0x290ADCcA6253aCe88b10A6bb34C07a5Ad10fC6B0');

      expect(result).toBe(false);
    });

    it('should return false if has no avatar', async () => {
      const result = await resolvers.selfid('0xd98420cFB1cd92828D192565A824B5728a566B11');

      expect(result).toBe(false);
    });

    it('returns false for the zero address (no fallback image)', async () => {
      const result = await resolvers.selfid(ZERO_ADDRESS);

      expect(result).toBe(false);
    });

    // Real-avatar image snapshot pending: Ceramic gateway is deprecated, so no
    // stable baseline can be minted. Tracked as a todo rather than a Buffer-size
    // assertion.
    it.todo('resolves and matches the reference avatar (Ceramic gateway deprecated)');
  });
});
