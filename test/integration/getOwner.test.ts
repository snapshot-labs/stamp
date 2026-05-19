import getOwner from '../../src/getOwner';

describe('getOwner', () => {
  describe('on claimed names', () => {
    it('should return an address for shibarium', async () => {
      const result = await getOwner('boorger.shib', '109');
      expect(result).toContain('0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6');
    });

    it('should return an address for puppynet', async () => {
      const result = await getOwner('snapshot-test-1.shib', '157');
      expect(result).toContain('0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3');
    });
  });

  describe('on unclaimed names', () => {
    // Unclaimed mainnet .shib domains: registered through the D3 partner but
    // never minted on-chain, so the D3 API returns them with no `owner` and
    // getOwner() must fall back to the DNS-resolved address. Each entry rots
    // individually when it gets claimed or expires, so the test asserts that
    // AT LEAST ONE of this set still resolves to its expected address.
    //
    // When this test fails, the whole set has rotted. To refresh it, list the
    // NFTs held by the unclaimed escrow 0x1A039289Af80a806f562396569fBC6d4A862C25c
    // (https://shibariumscan.io/api/v2/addresses/<escrow>/nft) and keep names
    // where getOwner(name, '109') returns a non-zero address.
    const UNCLAIMED_SHIBARIUM: Record<string, string> = {
      'jaguars.shib': '0x256102D1Df3DE85B59fD94f4aF9F78552B7Ebe13',
      'mini.shib': '0xC4De848f922CD6357bDB666009204EF923702A4E',
      'lib3rty.shib': '0x29B55b579b4A1A16bB445e2C56CB4d13af5ca095',
      'haihai.shib': '0xbF747B8ff8f5Eaf088AD19BBCd6cD3D5bD237C2B',
      '1980december12.shib': '0x18C2a024672293024069bB24f43595460065E84d',
      'kbeauty.shib': '0x110edF92d6c3dBcFB4dadb67894199A565413817',
      'honmoku.shib': '0x5B98E554a5B188D4CAD034a06C28484880eE4A16'
    };

    it('should return an address for shibarium', async () => {
      // Fires all checks concurrently; the assertion resolves true as soon as
      // one matches (remaining in-flight requests are not cancelled), and
      // false only once all have completed without a match (all rotted).
      const atLeastOneResolves = await new Promise<boolean>(resolve => {
        const entries = Object.entries(UNCLAIMED_SHIBARIUM);
        let pending = entries.length;
        entries.forEach(([handle, address]) => {
          getOwner(handle, '109')
            .then(result => {
              if (result.includes(address)) resolve(true);
            })
            .catch(() => undefined)
            .finally(() => {
              if (--pending === 0) resolve(false);
            });
        });
      });

      expect(atLeastOneResolves).toBe(true);
    });

    it('should return an address for puppynet', async () => {
      const result = await getOwner('snapshot-test-unclaimed.shib', '157');
      expect(result).toContain('0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3');
    });

    it('should return an empty address when the name does not have a primary names', async () => {
      const result = await getOwner('snapshot-test-unclaimed-unresolved.shib', '157');
      expect(result).toContain('0x0000000000000000000000000000000000000000');
    });
  });

  it('should return an empty address for shibarium when domain does not exist', async () => {
    const result = await getOwner('invalid-domain-h.shib', '109');
    expect(result).toContain('0x0000000000000000000000000000000000000000');
  });

  it('should return an empty address for puppynet when domain does not exist', async () => {
    const result = await getOwner('invalid-domain-h.shib', '157');
    expect(result).toContain('0x0000000000000000000000000000000000000000');
  });
});
