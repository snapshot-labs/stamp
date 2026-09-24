import { capture } from '@snapshot-labs/snapshot-sentry';
import { getProvider } from '../../../../src/helpers/provider';
import { resolveNames } from '../../../../src/resolvers/address/ens';
import { jsonResponse, mockGlobalFetch } from '../../../helpers/fetch';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../../../src/helpers/provider', () => {
  // Like the real getProvider, hands back the same instance on every call.
  const provider = {
    resolveName: jest.fn().mockResolvedValue(null),
    lookupAddress: jest.fn().mockResolvedValue(null)
  };
  return {
    ...jest.requireActual('../../../../src/helpers/provider'),
    getProvider: jest.fn(() => provider)
  };
});

const mockedFetch = mockGlobalFetch();

const providerInstanceHeldByEns = (getProvider as jest.Mock).mock.results[0].value;

const HANDLE = 'test.eth';
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

function respondWith(body: any, status = 200) {
  mockedFetch.mockResolvedValue(jsonResponse(body, status));
}

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

  it('keeps resolving a domain whose expiry is still in the future', async () => {
    respondWith({
      data: {
        domains: [
          {
            name: HANDLE,
            expiryDate: String(Math.floor(Date.now() / 1e3) + 3600),
            resolvedAddress: { id: ADDRESS.toLowerCase() }
          }
        ]
      }
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({ [HANDLE]: ADDRESS });
  });

  it('drops an expired domain instead of returning its last known address', async () => {
    respondWith({
      data: {
        domains: [
          { name: HANDLE, expiryDate: '1000000000', resolvedAddress: { id: ADDRESS.toLowerCase() } }
        ]
      }
    });

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(providerInstanceHeldByEns.resolveName).not.toHaveBeenCalled();
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
