import { graphQlCall } from '../../../../src/helpers/graphql';
import lookupDomains from '../../../../src/resolvers/lookupDomains/ens';

jest.mock('../../../../src/helpers/graphql', () => ({
  graphQlCall: jest.fn()
}));

const mockedGraphQlCall = graphQlCall as jest.Mock;
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';
const HASH_A = '9834876dcfb05cb167a5c24953eba58c4ac89b1adf57f28f2f9d09af107ee8f0';
const HASH_B = '3e744b9dc39389baf0c5a0660589b8402f3dbb49b89b3e75f2c9355852a3c677';
const HASH_C = '64daa44ad493ff28a96effab6e77f1732a3d97d83241581b37dbd70a7a4900fe';

function graphQlResponse<T>(data: T) {
  return { data };
}

function accountResponse(domains: { name: string; expiryDate?: string }[]) {
  return graphQlResponse({ account: { domains, wrappedDomains: [] } });
}

describe('lookupDomains/ens', () => {
  beforeEach(() => {
    mockedGraphQlCall.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('compares expiry dates numerically and preserves names without an expiry', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_787_572_496_000);
    mockedGraphQlCall.mockResolvedValueOnce(
      accountResponse([
        { name: 'expired.eth', expiryDate: '1787572495' },
        { name: 'permanent.eth', expiryDate: '0' },
        { name: 'subdomain.eth' },
        { name: 'far-future.eth', expiryDate: '13293458883' }
      ])
    );

    await expect(lookupDomains(ADDRESS)).resolves.toEqual([
      'permanent.eth',
      'subdomain.eth',
      'far-future.eth'
    ]);
  });

  it('loads all hashed labels in one domains query', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(
        accountResponse([
          { name: `[${HASH_A}].eth` },
          { name: 'plain.eth' },
          { name: `[${HASH_B}].eth` }
        ])
      )
      .mockResolvedValue(
        graphQlResponse({
          domains: [
            { labelhash: `0x${HASH_B}`, labelName: '$&' },
            { labelhash: `0x${HASH_A}`, labelName: 'alice' }
          ]
        })
      );

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(2);
    expect(result).toEqual(['alice.eth', 'plain.eth', '$&.eth']);
    expect(mockedGraphQlCall).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringContaining(
        'domains(first: $first, where: { labelhash_in: $hashes, labelName_not: null })'
      ),
      { hashes: [`0x${HASH_A}`, `0x${HASH_B}`], first: 1000 }
    );
  });

  it('resolves a label from duplicate rows sharing one labelhash', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: `[${HASH_A}].sub.eth` }]))
      .mockResolvedValueOnce(
        graphQlResponse({
          domains: [
            { labelhash: `0x${HASH_A}`, labelName: 'alice' },
            { labelhash: `0x${HASH_A}`, labelName: 'alice' }
          ]
        })
      );

    await expect(lookupDomains(ADDRESS)).resolves.toEqual(['alice.sub.eth']);
  });

  it('resolves every hashed label of a multi-level name', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(
        accountResponse([
          { name: `[${HASH_A}].[${HASH_B}].[${HASH_C}].eth` },
          { name: `[${HASH_C}].eth` }
        ])
      )
      .mockResolvedValueOnce(
        graphQlResponse({
          domains: [
            { labelhash: `0x${HASH_A}`, labelName: 'alice' },
            { labelhash: `0x${HASH_C}`, labelName: 'aragonid' }
          ]
        })
      );

    await expect(lookupDomains(ADDRESS)).resolves.toEqual([
      `alice.[${HASH_B}].aragonid.eth`,
      'aragonid.eth'
    ]);
    expect(mockedGraphQlCall.mock.calls[1][2]).toEqual({
      hashes: [`0x${HASH_A}`, `0x${HASH_B}`, `0x${HASH_C}`],
      first: 1000
    });
  });

  it('requests a fixed page size regardless of how many hashes are looked up', async () => {
    const domains = Array.from({ length: 1500 }, (_, index) => ({
      name: `[${String(index).padStart(64, '0')}].eth`
    }));
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse(domains))
      .mockResolvedValueOnce(graphQlResponse({ domains: [] }));

    await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall.mock.calls[1][2]).toEqual(expect.objectContaining({ first: 1000 }));
  });

  it('does not query domains when no name has a hashed label', async () => {
    mockedGraphQlCall.mockResolvedValueOnce(accountResponse([{ name: 'plain.eth' }]));

    await expect(lookupDomains(ADDRESS)).resolves.toEqual(['plain.eth']);
    expect(mockedGraphQlCall).toHaveBeenCalledTimes(1);
  });

  it('leaves an empty bracket untouched instead of querying the subgraph for it', async () => {
    mockedGraphQlCall.mockResolvedValueOnce(accountResponse([{ name: '[].eth' }]));

    await expect(lookupDomains(ADDRESS)).resolves.toEqual(['[].eth']);
    expect(mockedGraphQlCall).toHaveBeenCalledTimes(1);
  });

  it('leaves a bracket that is not a 64-hex labelhash untouched instead of sending it to the subgraph', async () => {
    mockedGraphQlCall.mockResolvedValueOnce(
      accountResponse([{ name: 'a[bbb].c.eth' }, { name: '[AAA].eth' }, { name: '[[aaa]].eth' }])
    );

    await expect(lookupDomains(ADDRESS)).resolves.toEqual([
      'a[bbb].c.eth',
      '[AAA].eth',
      '[[aaa]].eth'
    ]);
    expect(mockedGraphQlCall).toHaveBeenCalledTimes(1);
  });

  it('rejects when the domains list is null', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: `[${HASH_A}].eth` }]))
      .mockResolvedValueOnce(graphQlResponse({ domains: null }));

    await expect(lookupDomains(ADDRESS)).rejects.toThrow();
  });

  it('rejects when the domains response has no data envelope', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: `[${HASH_A}].eth` }]))
      .mockResolvedValueOnce({ data: {} });

    await expect(lookupDomains(ADDRESS)).rejects.toThrow();
  });
});
