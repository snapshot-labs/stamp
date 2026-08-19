import { capture } from '@snapshot-labs/snapshot-sentry';
import axios from 'axios';
import { getProvider } from '../../../../src/helpers/provider';
import { resolveNames } from '../../../../src/resolvers/address/ens';

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
const mockedProvider = (getProvider as jest.Mock).mock.results[0].value;

const HANDLE = 'test.eth';
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

describe('resolvers/address/ens - resolveNames', () => {
  beforeEach(() => {
    mockedAxios.mockReset();
    mockedProvider.resolveName.mockReset().mockResolvedValue(null);
  });

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

  it('skips names owned by sibling resolvers before querying ENS', async () => {
    const names = ['foo.lens', 'foo.bnb', 'foo.stark', 'foo.gwei', 'foo.shib'];

    await expect(resolveNames(names)).resolves.toEqual({});

    expect(mockedAxios).not.toHaveBeenCalled();
    expect(mockedProvider.resolveName).not.toHaveBeenCalled();
  });

  it('keeps ENS and DNS names in their original fallback order', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      data: {
        data: { domains: [{ name: HANDLE, resolvedAddress: { id: ADDRESS.toLowerCase() } }] }
      }
    });
    mockedProvider.resolveName.mockResolvedValue(ADDRESS);

    await expect(
      resolveNames(['foo.lens', HANDLE, 'foo.xyz', 'api.lens.xyz', 'bridge.base.eth'])
    ).resolves.toEqual({
      [HANDLE]: ADDRESS,
      'foo.xyz': ADDRESS,
      'api.lens.xyz': ADDRESS,
      'bridge.base.eth': ADDRESS
    });

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variables: { handles: [HANDLE, 'foo.xyz', 'api.lens.xyz', 'bridge.base.eth'] }
        })
      })
    );
    expect(mockedProvider.resolveName.mock.calls).toEqual([
      ['foo.xyz'],
      ['api.lens.xyz'],
      ['bridge.base.eth']
    ]);
  });
});
