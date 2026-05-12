import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/ens';
import testAddressResolver from './helper';

testAddressResolver({
  name: 'ENS',
  lookupAddresses,
  resolveNames,
  validAddress: '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
  validDomain: 'sdntestens.eth',
  blankAddress: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  invalidDomains: ['domain.crypto', 'domain.lens', 'domain.com']
});

describe('ENS address resolver: CCIP-Read fallback', () => {
  // avsa.eth's primary name is set via an off-chain resolver that the batch
  // getNames contract doesn't follow, so the fallback to provider.lookupAddress
  // is required.
  it('resolves names that the batch contract misses', async () => {
    const address = '0x809FA673fe2ab515FaA168259cB14E2BeDeBF68e';
    await expect(lookupAddresses([address])).resolves.toEqual({
      [address]: 'avsa.eth'
    });
  }, 15e3);
});
