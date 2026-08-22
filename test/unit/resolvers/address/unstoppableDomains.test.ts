import snapshot from '@snapshot-labs/snapshot.js';
import { resolveNames } from '../../../../src/resolvers/address/unstoppableDomains';

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const mockedCall = jest.spyOn(snapshot.utils, 'call');

afterAll(() => {
  mockedCall.mockRestore();
});

beforeEach(() => {
  mockedCall.mockResolvedValue(ADDRESS);
});

describe('resolvers/address/unstoppableDomains - resolveNames', () => {
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
