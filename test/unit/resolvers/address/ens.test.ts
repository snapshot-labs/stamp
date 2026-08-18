import { capture } from '@snapshot-labs/snapshot-sentry';
import { getProvider } from '../../../../src/helpers/provider';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/ens';
import * as universalResolver from '../../../../src/resolvers/address/universalResolver';
import { jsonResponse, mockGlobalFetch } from '../../../helpers/fetch';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../../../src/helpers/provider', () => ({
  ...jest.requireActual('../../../../src/helpers/provider'),
  getProvider: jest.fn(() => ({
    resolveName: jest.fn().mockResolvedValue(null),
    lookupAddress: jest.fn().mockResolvedValue(null)
  }))
}));

const mockedFetch = mockGlobalFetch();

const providerInstanceHeldByEns = (getProvider as jest.Mock).mock.results[0].value;

const HANDLE = 'test.eth';
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

function respondWith(body: any, status = 200) {
  mockedFetch.mockResolvedValue(jsonResponse(body, status));
}

describe('resolvers/address/ens - lookupAddresses', () => {
  it('surfaces a transport failure when no address resolves', async () => {
    const error = new Error('transport failed');
    const reverseLookup = jest.spyOn(universalResolver, 'reverseLookup').mockResolvedValue({
      values: {},
      errors: [error]
    });

    try {
      await expect(lookupAddresses([ADDRESS])).rejects.toBe(error);
    } finally {
      reverseLookup.mockRestore();
    }
  });
});

describe('resolvers/address/ens - resolveNames', () => {
  it('reports the subgraph failure instead of a TypeError naming our own field', async () => {
    respondWith({ errors: [{ message: 'bad indexers' }], data: null });

    await expect(resolveNames([HANDLE])).resolves.toEqual({});

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ message: '[subgrapher.snapshot.org] bad indexers' }),
      { input: { handles: [HANDLE] } }
    );
  });

  it('resolves from the subgraph and reports nothing when it answers', async () => {
    respondWith({
      data: { domains: [{ name: HANDLE, resolvedAddress: { id: ADDRESS.toLowerCase() } }] }
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({ [HANDLE]: ADDRESS });
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not report a subgraph host that no longer resolves', async () => {
    mockedFetch.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    );

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).not.toHaveBeenCalled();
  });

  it('still reports a subgraph host answering with a 4xx', async () => {
    respondWith({}, 404);

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }), {
      input: { handles: [HANDLE] }
    });
  });

  it('still reports a malformed address returned by the subgraph itself', async () => {
    respondWith({
      data: { domains: [{ name: HANDLE, resolvedAddress: { id: 'not-a-valid-address' } }] }
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ARGUMENT' }), {
      input: { handles: [HANDLE] }
    });
  });

  it('still reports a malformed address returned by the provider fallback', async () => {
    respondWith({ data: { domains: [] } });
    providerInstanceHeldByEns.resolveName.mockResolvedValueOnce('not-a-valid-address');

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ARGUMENT' }), {
      input: { handles: [HANDLE] }
    });
  });
});
