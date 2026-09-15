import { isTestnet } from '../../../src/helpers/chains';

describe('helpers/chains', () => {
  describe('isTestnet', () => {
    it.each([
      ['a testnet', '11155111', true],
      ['a mainnet', '1', false],
      // Absent chains fall on the mainnet side, so one added ahead of
      // snapshot.js lands in the defaults rather than being filtered out.
      ['a chain snapshot.js does not know', '999999999', false]
    ] as const)('reports %s as %p', (_label, chainId, expected) => {
      expect(isTestnet(chainId)).toBe(expected);
    });
  });
});
