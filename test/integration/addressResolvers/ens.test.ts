import { capture } from '@snapshot-labs/snapshot-sentry';
import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/ens';
import * as universalResolver from '../../../src/addressResolvers/universalResolver';
import { FetchError } from '../../../src/addressResolvers/utils';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

testAddressResolver({
  name: 'ENS',
  lookupAddresses,
  resolveNames,
  validAddress: '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
  validDomain: 'sdntestens.eth',
  blankAddress: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  invalidDomains: ['domain.crypto', 'domain.lens', 'domain.com']
});

describe('ENS address resolver: Universal Resolver', () => {
  it('resolves names served by off-chain (CCIP-Read) resolvers', async () => {
    const address = '0x809FA673fe2ab515FaA168259cB14E2BeDeBF68e';
    await expect(lookupAddresses([address])).resolves.toEqual({
      [address]: 'avsa.eth'
    });
  }, 20e3);

  it('returns nothing for an expired name without throwing', async () => {
    const address = '0x9c3aC02Cd616a82C83830e40D45c9534b32c4934';
    await expect(lookupAddresses([address])).resolves.toEqual({});
  }, 20e3);

  it('isolates per-address failures within a batch', async () => {
    const expired = '0x9c3aC02Cd616a82C83830e40D45c9534b32c4934';
    const good = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';

    await expect(lookupAddresses([expired, good])).resolves.toEqual({
      [good]: 'sdntestens.eth'
    });
  }, 20e3);

  it('throws a FetchError and reports when the whole batch fails', async () => {
    const error = Object.assign(new Error('boom'), { code: 'SERVER_ERROR' });
    const spy = jest
      .spyOn(universalResolver, 'reverseLookup')
      .mockResolvedValueOnce({ values: {}, errors: [error] });
    const address = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';

    try {
      await expect(lookupAddresses([address])).rejects.toBeInstanceOf(FetchError);
      expect(capture).toHaveBeenCalledWith(error, { input: { addresses: [address] } });
    } finally {
      spy.mockRestore();
    }
  });
});
