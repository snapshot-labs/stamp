import testAddressResolver from './helper';
import { CacheResult, NON_CACHEABLE } from '../../../../src/resolvers/address/cache';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/ens';

testAddressResolver({
  name: 'ENS',
  lookupAddresses,
  resolveNames,
  validAddress: '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
  validDomain: 'sdntestens.eth',
  blankAddress: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  invalidDomains: ['domain.crypto', 'domain.lens', 'domain.com']
});

describe('ENS address resolver: CCIP-Read', () => {
  it('resolves onchain and offchain names while omitting a missing resolver', async () => {
    await expect(resolveNames(['sdntestens.eth', 'jesse.base.eth', 'foo.lens'])).resolves.toEqual({
      'sdntestens.eth': '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
      'jesse.base.eth': '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9'
    });
  }, 15e3);

  it('resolves a name served by an offchain resolver', async () => {
    const address = '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9';
    await expect(lookupAddresses([address])).resolves.toEqual({
      [address]: 'jesse.base.eth'
    });
  }, 15e3);

  it('keeps another result when one reverse name has expired', async () => {
    const expiredAddress = '0x3a872f8FED4421E7d5BE5c98Ab5Ea0e0245169A0';
    const goodAddress = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';

    const result = (await lookupAddresses([expiredAddress, goodAddress])) as CacheResult;

    expect(result).toEqual({ [goodAddress]: 'sdntestens.eth' });
    expect(result[NON_CACHEABLE]).toEqual([expiredAddress]);
  }, 20e3);
});
