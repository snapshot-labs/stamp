import lookupDomains from '../../src/lookupDomains';

describe('lookupDomains', () => {
  it('should return an array of addresses on default network', async () => {
    const result = await lookupDomains('0x24F15402C6Bb870554489b2fd2049A85d75B982f');

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain('.eth');
  });

  it('should return an array of addresses on sepolia', async () => {
    const result = await lookupDomains('0x24F15402C6Bb870554489b2fd2049A85d75B982f', '11155111');

    expect(result).toContain('testchaitu.eth');
  });

  it('should return an empty array if the address is not provided', async () => {
    const result = await lookupDomains('');

    expect(result).toEqual([]);
  });

  it('should return an empty array if the address does not own any domains', async () => {
    const result = await lookupDomains('0xf1f09AdC06aAB740AA16004D62Dbd89484d3Be90');

    expect(result).toEqual([]);
  });

  it('should return empty array on invalid network', async () => {
    const result = await lookupDomains('0x24F15402C6Bb870554489b2fd2049A85d75B982f', 'test');

    expect(result).toEqual([]);
  });

  it('should filter out expired domains', async () => {
    const result = await lookupDomains('0x76ece6825602294b87a40d783982d83bb8ebcaf7');

    expect(result).not.toContain(['everaidao.eth', 'everark.eth', 'everaiark.eth']);
  });

  it('should return an empty array if the address is not a valid address', async () => {
    const result = await lookupDomains('notAValidAddress');
    expect(result).toEqual([]);
  });

  it('should return an array of addresses for shibarium', async () => {
    const result = await lookupDomains('0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6', '109');
    expect(result).toContain('boorger.shib');
  });

  it('should return an empty array if the address does not own any shibarium domains', async () => {
    const result = await lookupDomains('0x757a20E145435B5bDaf0E274987653aeCD47cf37', '109');
    expect(result).toEqual([]);
  });

  it('should return all the addresses from the given chain', async () => {
    const result = await lookupDomains('0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6', ['1', '109']);
    expect(result).toContain('boorger.eth');
    expect(result).toContain('boorger.shib');
  });

  it('should return an array of addresses for unstoppable domains', async () => {
    const result = await lookupDomains('0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6', '146');
    expect(result).toContain('boorger.sonic');
  });

  it('should return an empty array if the address does not own any unstoppable domains', async () => {
    const result = await lookupDomains('0x76ece6825602294b87a40d783982d83bb8ebcaf7', '146');
    expect(result).toEqual([]);
  });
});
