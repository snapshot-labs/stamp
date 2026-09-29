import { getBaseAssetIconUrl, isTestnet } from '../../../src/helpers/chains';

const ETH_LOGO = getBaseAssetIconUrl('1');

describe('helpers/chains', () => {
  describe('getBaseAssetIconUrl', () => {
    it.each(['1', '8453', '59144', '11155111'])(
      'gives chain %s, native ETH, the ETH logo',
      chainId => {
        expect(getBaseAssetIconUrl(chainId)).toBe(ETH_LOGO);
      }
    );

    it('gives a mapped non-ETH chain its own logo', () => {
      expect(getBaseAssetIconUrl('56')).not.toBe(ETH_LOGO);
    });

    it.each(['43114', '146', '250', '999999999'])('has no logo for chain %s', chainId => {
      expect(getBaseAssetIconUrl(chainId)).toBeNull();
    });
  });

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
