import { graphQlCall } from '../../../../src/helpers/graphql';
import lookupDomains from '../../../../src/resolvers/lookupDomains/ensV2';

jest.mock('../../../../src/helpers/graphql', () => ({
  graphQlCall: jest.fn()
}));

const mockedGraphQlCall = graphQlCall as jest.Mock;
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const CHAIN_ID = '11155111';
const ENDPOINT = 'https://staging-graphql.ens.dev/';

function domainsResponse(domains: { name: string; expiryDate?: number }[]) {
  return { data: { domains } };
}

describe('lookupDomains/ensV2', () => {
  beforeEach(() => {
    mockedGraphQlCall.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the names owned by the address on the configured endpoint', async () => {
    mockedGraphQlCall.mockResolvedValueOnce(
      domainsResponse([{ name: 'testspace.eth' }, { name: 'boorger.eth' }])
    );

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([
      'testspace.eth',
      'boorger.eth'
    ]);
    expect(mockedGraphQlCall).toHaveBeenCalledTimes(1);
    expect(mockedGraphQlCall).toHaveBeenCalledWith(
      ENDPOINT,
      expect.stringContaining('domains(where: $where, first: $first)'),
      { where: { owner: ADDRESS.toLowerCase() }, first: 1000 }
    );
  });

  it('filters expired names and keeps the ones without an expiry', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_787_572_496_000);
    mockedGraphQlCall.mockResolvedValueOnce(
      domainsResponse([
        { name: 'expired.eth', expiryDate: 1_787_572_495 },
        { name: 'permanent.eth', expiryDate: 0 },
        { name: 'subdomain.eth' },
        { name: 'far-future.eth', expiryDate: 13_293_458_883 }
      ])
    );

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).resolves.toEqual([
      'permanent.eth',
      'subdomain.eth',
      'far-future.eth'
    ]);
  });

  it('returns an empty array without a request on a chain without an endpoint', async () => {
    await expect(lookupDomains(ADDRESS, '137')).resolves.toEqual([]);
    expect(mockedGraphQlCall).not.toHaveBeenCalled();
  });

  it('does not query anything on the default chain', async () => {
    await expect(lookupDomains(ADDRESS)).resolves.toEqual([]);
    expect(mockedGraphQlCall).not.toHaveBeenCalled();
  });

  it('rejects instead of swallowing an upstream failure', async () => {
    mockedGraphQlCall.mockRejectedValueOnce(new Error('endpoint moved'));

    await expect(lookupDomains(ADDRESS, CHAIN_ID)).rejects.toThrow('endpoint moved');
  });
});
