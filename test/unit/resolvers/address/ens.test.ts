import { capture } from '@snapshot-labs/snapshot-sentry';
import axios from 'axios';
import { CacheResult, NON_CACHEABLE } from '../../../../src/resolvers/address/cache';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/ens';
import * as universalResolver from '../../../../src/resolvers/address/universalResolver';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('axios', () => {
  const mock: any = jest.fn();
  mock.get = jest.fn();
  mock.post = jest.fn();
  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/helpers/provider', () => ({
  ...jest.requireActual('../../../../src/helpers/provider'),
  getProvider: jest.fn(() => ({
    resolveName: jest.fn().mockResolvedValue(null),
    lookupAddress: jest.fn().mockResolvedValue(null)
  }))
}));

const mockedAxios = axios as unknown as jest.Mock;

const HANDLE = 'test.eth';
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const OTHER_ADDRESS = '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1';

function abortError() {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

describe('resolvers/address/ens - lookupAddresses', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces a transport failure when every address lookup rejects', async () => {
    const error = new Error('transport failed');
    jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: {},
      errors: [{ address: ADDRESS, error }]
    });

    await expect(lookupAddresses([ADDRESS])).rejects.toBe(error);
  });

  it('keeps a fulfilled empty lookup separate from a rejected lookup', async () => {
    const error = new Error('transport failed');
    jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: {},
      errors: [{ address: OTHER_ADDRESS, error }]
    });

    const result = (await lookupAddresses([ADDRESS, OTHER_ADDRESS])) as CacheResult;

    expect(result).toEqual({});
    expect(result[NON_CACHEABLE]).toEqual([OTHER_ADDRESS]);
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Ens' },
      contexts: { input: { lookupAddresses: [OTHER_ADDRESS] } }
    });
  });

  it('keeps a name and reports its rejected sibling', async () => {
    const error = new Error('contract response failed');
    jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: { [ADDRESS]: HANDLE },
      errors: [{ address: OTHER_ADDRESS, error }]
    });

    const result = (await lookupAddresses([ADDRESS, OTHER_ADDRESS])) as CacheResult;

    expect(result).toEqual({ [ADDRESS]: HANDLE });
    expect(result[NON_CACHEABLE]).toEqual([OTHER_ADDRESS]);
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Ens' },
      contexts: { input: { lookupAddresses: [OTHER_ADDRESS] } }
    });
  });

  it('keeps a name without reporting a silenced rejected sibling', async () => {
    const error = abortError();
    jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: { [ADDRESS]: HANDLE },
      errors: [{ address: OTHER_ADDRESS, error }]
    });

    const result = (await lookupAddresses([ADDRESS, OTHER_ADDRESS])) as CacheResult;

    expect(result).toEqual({ [ADDRESS]: HANDLE });
    expect(result[NON_CACHEABLE]).toEqual([OTHER_ADDRESS]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('surfaces an actionable error when every lookup rejects', async () => {
    const actionable = new Error('invalid contract response');
    jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: {},
      errors: [
        { address: ADDRESS, error: abortError() },
        { address: OTHER_ADDRESS, error: actionable }
      ]
    });

    await expect(lookupAddresses([ADDRESS, OTHER_ADDRESS])).rejects.toBe(actionable);
  });
});

describe('resolvers/address/ens - resolveNames', () => {
  it('reports the subgraph failure instead of a TypeError naming our own field', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      data: { errors: [{ message: 'bad indexers' }], data: null }
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({});

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: '[subgrapher.snapshot.org] bad indexers' }),
      { input: { handles: [HANDLE] } }
    );
  });

  it('resolves from the subgraph and reports nothing when it answers', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      data: {
        data: { domains: [{ name: HANDLE, resolvedAddress: { id: ADDRESS.toLowerCase() } }] }
      }
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({ [HANDLE]: ADDRESS });
    expect(capture).not.toHaveBeenCalled();
  });
});
