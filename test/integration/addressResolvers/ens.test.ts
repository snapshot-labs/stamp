import { capture } from '@snapshot-labs/snapshot-sentry';
import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/ens';
import * as universalResolver from '../../../src/addressResolvers/universalResolver';

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves names served by off-chain (CCIP-Read) resolvers', async () => {
    const address = '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9';
    await expect(lookupAddresses([address])).resolves.toEqual({
      [address]: 'jesse.base.eth'
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

  it('rethrows the original error when the whole batch fails', async () => {
    const error = Object.assign(new Error('boom'), { code: 'SERVER_ERROR' });
    jest
      .spyOn(universalResolver, 'reverseLookup')
      .mockResolvedValueOnce({ values: {}, errors: [error] });
    const address = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';

    // The resolver rethrows the original error untouched. Reporting it is
    // addressResolvers/index.ts' job now, so nothing is captured here.
    await expect(lookupAddresses([address])).rejects.toBe(error);
    expect(capture).not.toHaveBeenCalled();
  });

  it('reports the errors of a partly resolved batch, which never reach index.ts', async () => {
    const error = Object.assign(new Error('boom'), { code: 'SERVER_ERROR' });
    const good = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';
    const bad = '0x9c3aC02Cd616a82C83830e40D45c9534b32c4934';
    jest
      .spyOn(universalResolver, 'reverseLookup')
      .mockResolvedValueOnce({ values: { [good]: 'sdntestens.eth' }, errors: [error] });

    await expect(lookupAddresses([bad, good])).resolves.toEqual({ [good]: 'sdntestens.eth' });
    expect(capture).toHaveBeenCalledWith(error, { input: { addresses: [bad, good] } });
  });

  it('does not report a silenced error', async () => {
    const error = Object.assign(new Error('boom'), { code: 'ETIMEDOUT' });
    const good = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';
    jest
      .spyOn(universalResolver, 'reverseLookup')
      .mockResolvedValueOnce({ values: { [good]: 'sdntestens.eth' }, errors: [error] });

    await expect(lookupAddresses([good])).resolves.toEqual({ [good]: 'sdntestens.eth' });
    expect(capture).not.toHaveBeenCalled();
  });
});
