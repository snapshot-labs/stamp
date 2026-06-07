import resolvers from '../../../src/resolvers';
import { avatarId } from '../../helpers/validation';

describe('resolvers', () => {
  jest.retryTimes(3);

  describe('basename', () => {
    it('should resolve an avatar by basename', async () => {
      const result = await resolvers.basename(avatarId('jesse.base.eth'));

      expect(result).toBeInstanceOf(Buffer);
      return expect((result as Buffer).length).toBeGreaterThan(1000);
    }, 30e3);

    it('should resolve an avatar by address', async () => {
      const result = await resolvers.basename(
        avatarId('0x2211d1D0020DAEA8039E46Cf1367962070d77DA9')
      );

      expect(result).toBeInstanceOf(Buffer);
      return expect((result as Buffer).length).toBeGreaterThan(1000);
    }, 30e3);

    it('should return false for an address without a basename', async () => {
      const result = await resolvers.basename(
        avatarId('0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1')
      );

      return expect(result).toBe(false);
    }, 30e3);

    it('should return false for a non-basename input', async () => {
      const result = await resolvers.basename(avatarId('vitalik.eth'));

      return expect(result).toBe(false);
    }, 10e3);
  });
});
