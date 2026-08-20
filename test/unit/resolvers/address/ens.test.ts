import { capture } from '@snapshot-labs/snapshot-sentry';
import { CacheResult, NON_CACHEABLE } from '../../../../src/resolvers/address/cache';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/ens';
import * as universalResolver from '../../../../src/resolvers/address/universalResolver';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

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

  it('keeps a silenced gateway failure retryable when every lookup rejects', async () => {
    const error = new Error('gateway failed');
    jest.spyOn(universalResolver, 'isSilencedReverseError').mockReturnValue(true);
    jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: {},
      errors: [{ address: ADDRESS, error }]
    });

    const result = (await lookupAddresses([ADDRESS])) as CacheResult;

    expect(result).toEqual({});
    expect(result[NON_CACHEABLE]).toEqual([ADDRESS]);
    expect(capture).not.toHaveBeenCalled();
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
    const error = new Error('gateway failed');
    jest.spyOn(universalResolver, 'isSilencedReverseError').mockReturnValue(true);
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves normalized handles through the Universal Resolver', async () => {
    const lookup = jest.spyOn(universalResolver, 'forwardLookup').mockResolvedValue({
      values: { [HANDLE]: ADDRESS.toLowerCase() },
      errors: []
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({ [HANDLE]: ADDRESS });
    expect(lookup).toHaveBeenCalledWith([HANDLE]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps rejected names retryable and reports the failure', async () => {
    const error = new Error('transport failed');
    jest.spyOn(universalResolver, 'forwardLookup').mockResolvedValue({
      values: {},
      errors: [{ name: HANDLE, error }]
    });

    const result = (await resolveNames([HANDLE])) as CacheResult;

    expect(result).toEqual({});
    expect(result[NON_CACHEABLE]).toEqual([HANDLE]);
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Ens' },
      contexts: { input: { resolveNames: [HANDLE] } }
    });
  });
});
