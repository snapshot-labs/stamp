import getOwner from '../../src/getOwner';

describe('getOwner', () => {
  describe('on claimed names', () => {
    it('should return an address for shibarium', async () => {
      const result = await getOwner('boorger.shib', '109');
      expect(result).toContain('0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6');
    });

    // it('should return an address for puppynet', async () => {
    //   const result = await getOwner('snapshot-test-1.shib', '157');
    //   expect(result).toContain('0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3');
    // });
  });

  describe('on unclaimed names', () => {
    // This may stop working since we don't own this domain.
    // In such case, go to https://www.shibariumscan.io/name-domains?only_active=true
    // and find a domain that is not claimed (owner = 0x1A039289Af80a806f562396569fBC6d4A862C25c),
    // but has a resolved address.
    it('should return an address for shibarium', async () => {
      const result = await getOwner('scoobysnacks.shib', '109');
      expect(result).toContain('0xa226a85fF338f5015cd3Da6a987CD08D70619977');
    });

    // it('should return an address for puppynet', async () => {
    //   const result = await getOwner('snapshot-test-unclaimed.shib', '157');
    //   expect(result).toContain('0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3');
    // });

    it('should return an empty address when the name does not have a primary names', async () => {
      const result = await getOwner('snapshot-test-unclaimed-unresolved.shib', '157');
      expect(result).toContain('0x0000000000000000000000000000000000000000');
    });
  });

  it('should return an empty address for shibarium when domain does not exist', async () => {
    const result = await getOwner('invalid-domain-h.shib', '109');
    expect(result).toContain('0x0000000000000000000000000000000000000000');
  });

  // it('should return an empty address for puppynet when domain does not exist', async () => {
  //   const result = await getOwner('invalid-domain-h.shib', '157');
  //   expect(result).toContain('0x0000000000000000000000000000000000000000');
  // });
});
