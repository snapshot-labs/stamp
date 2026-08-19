import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { resolveNames } from '../../../../src/resolvers/address/unstoppableDomains';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

const HANDLE = 'test.crypto';
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const mockedCall = jest.spyOn(snapshot.utils, 'call');

afterAll(() => {
  mockedCall.mockRestore();
});

beforeEach(() => {
  mockedCall.mockResolvedValue(ADDRESS);
});

describe('resolvers/address/unstoppableDomains - resolveNames', () => {
  it('reports a resolver failure', async () => {
    const error = new Error('boom');
    mockedCall.mockRejectedValue(error);

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledWith(error, { input: { handles: [HANDLE] } });
  });

  it.each([
    [
      'a host that no longer resolves',
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    ],
    [
      'a TLS failure',
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } })
    ]
  ] as const)('does not capture a transport failure (%s)', async (_label, error) => {
    mockedCall.mockRejectedValue(error);

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).not.toHaveBeenCalled();
  });

  it('still reports a plain upstream 4xx from the fixed contract endpoint', async () => {
    const error = Object.assign(new Error('not found'), { status: 404 });
    mockedCall.mockRejectedValue(error);

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledWith(error, { input: { handles: [HANDLE] } });
  });

  it('resolves successfully and reports nothing', async () => {
    await expect(resolveNames([HANDLE])).resolves.toEqual({ [HANDLE]: ADDRESS });
    expect(capture).not.toHaveBeenCalled();
  });

  it('skips names owned by sibling resolvers before querying UNS', async () => {
    const names = ['foo.lens', 'foo.bnb', 'foo.stark', 'foo.gwei', 'foo.shib'];

    await expect(resolveNames(names)).resolves.toEqual({});

    expect(mockedCall).not.toHaveBeenCalled();
  });

  it('keeps supported UNS names and existing unsupported-name handling', async () => {
    await expect(
      resolveNames(['foo.lens', 'foo.crypto', 'api.lens.crypto', 'vitalik.eth', 'foo.xyz'])
    ).resolves.toEqual({
      'foo.crypto': ADDRESS,
      'api.lens.crypto': ADDRESS
    });

    expect(mockedCall).toHaveBeenCalledTimes(2);
  });
});
