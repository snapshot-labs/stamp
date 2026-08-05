import { capture } from '@snapshot-labs/snapshot-sentry';
import axios from 'axios';
import { resolveNames } from '../../../src/addressResolvers/ens';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('axios', () => {
  const mock: any = jest.fn();
  mock.get = jest.fn();
  mock.post = jest.fn();
  return { __esModule: true, default: mock };
});

// resolveNames falls back to the provider for anything the subgraph did not
// answer. Stub it so the test never leaves the process.
jest.mock('../../../src/addressResolvers/utils', () => ({
  ...jest.requireActual('../../../src/addressResolvers/utils'),
  provider: jest.fn(() => ({
    resolveName: jest.fn().mockResolvedValue(null),
    lookupAddress: jest.fn().mockResolvedValue(null)
  }))
}));

const mockedAxios = axios as unknown as jest.Mock;

const HANDLE = 'test.eth';
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

describe('addressResolvers/ens - resolveNames', () => {
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
