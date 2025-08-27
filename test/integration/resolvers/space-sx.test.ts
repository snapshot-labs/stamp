import resolvers from '../../../src/resolvers';

describe('resolvers', () => {
  describe('space-sx', () => {
    describe('avatar', () => {
      it('should return false if missing', async () => {
        const result = await resolvers['space-sx']('0x06ba9855965EeEc09B5D43B113944c27F45aD3Ce');

        expect(result).toBe(false);
      });

      it('should return false if address is invalid', async () => {
        const result = await resolvers['space-sx']('0x00006ba9855965EeEc09B5D43B113944c27F45aD3Ce');

        expect(result).toBe(false);
      });

      it.todo('should resolve on eth');

      it('should resolve on arbitrum', async () => {
        const result = await resolvers['space-sx']('0xFd36252770642Ac48FC3A06d7A1D00be8946dd18');

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(100);
      });

      it('should resolve on optimism', async () => {
        const result = await resolvers['space-sx']('0x2EF7E7CF469f5296011664682D58b57D38a3c83f');

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(100);
      });

      it('should resolve on starknet', async () => {
        const result = await resolvers['space-sx'](
          '0x010841ba1d0c66602aa27837560823e631b19686ebbdcd591caa42a7c01611c0'
        );

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(100);
      });

      it('should resolve on starknet sepolia', async () => {
        const result = await resolvers['space-sx'](
          '0x00a330d13703f0af4f87e65d95c898297f8ce6e88ac7e9bff3b3bd270d2f6d5b'
        );

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(100);
      });

      it('should resolve on sepolia', async () => {
        const result = await resolvers['space-sx']('0xbFF55fd2A671288316956A0Cae8f1d24BA7E5C9B');

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(100);
      });
    });
  });
});
