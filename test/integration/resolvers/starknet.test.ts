import resolvers from '../../../src/resolvers';

describe('resolvers', () => {
  describe('starknet', () => {
    jest.retryTimes(3);

    it('should return false if missing', async () => {
      const result = await resolvers.starknet('test-not-existing.stark');

      expect(result).toBe(false);
    });

    describe('with a simple image', () => {
      it('should resolve with address', async () => {
        const result = await resolvers.starknet(
          '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a'
        );

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(1000);
      });
    });

    describe('with the default image', () => {
      it('should return false', async () => {
        const result = await resolvers.starknet(
          '0x0047f2e8dbf39f6856fc2437dfc931e3b3a64bfe240218046f2a9fca80e768d4'
        );

        expect(result).toBe(false);
      });
    });

    describe('with an NFT image', () => {
      it('should resolve with handle', async () => {
        const result = await resolvers.starknet('pragmarob.stark');

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(1000);
      });

      it('should resolve with address', async () => {
        const result = await resolvers.starknet(
          '0x007b275f7524f39b99a51c7134bc44204fedc5dd1e982e920eb2047c6c2a71f0'
        );

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(1000);
      });
    });
  });
});
