import snapshot from '@snapshot-labs/snapshot.js';
import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/ens';
import { FetchError } from '../../../src/addressResolvers/utils';

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

  it('falls back to per-address lookups when the batch reverse call reverts', async () => {
    const ccipAddress = '0x3a872f8FED4421E7d5BE5c98Ab5Ea0e0245169A0';
    const goodAddress = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';

    await expect(lookupAddresses([ccipAddress])).resolves.toEqual({});
    await expect(lookupAddresses([ccipAddress, goodAddress])).resolves.toEqual({
      [goodAddress]: 'sdntestens.eth'
    });
  }, 20e3);

  it('still surfaces non-CALL_EXCEPTION batch errors', async () => {
    jest.spyOn(snapshot.utils, 'call').mockRejectedValueOnce(
      Object.assign(new Error('timeout'), {
        code: 'ETIMEDOUT'
      })
    );

    await expect(
      lookupAddresses(['0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC'])
    ).rejects.toBeInstanceOf(FetchError);
  });
});
