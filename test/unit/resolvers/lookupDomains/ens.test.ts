import { graphQlCall } from '../../../../src/helpers/graphql';
import lookupDomains from '../../../../src/resolvers/lookupDomains/ens';

jest.mock('../../../../src/helpers/graphql', () => ({
  graphQlCall: jest.fn()
}));

const mockedGraphQlCall = graphQlCall as jest.Mock;
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

function graphQlResponse<T>(data: T) {
  return { data };
}

function accountResponse(domains: { name: string }[]) {
  return graphQlResponse({ account: { domains, wrappedDomains: [] } });
}

describe('lookupDomains/ens', () => {
  beforeEach(() => {
    mockedGraphQlCall.mockReset();
  });

  it('loads all hashed labels in one domains query', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(
        accountResponse([{ name: '[aaa].eth' }, { name: 'plain.eth' }, { name: '[bbb].eth' }])
      )
      .mockResolvedValue(
        graphQlResponse({
          domains: [
            { labelhash: '0xbbb', labelName: '$&' },
            { labelhash: '0xaaa', labelName: 'alice' }
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
      { hashes: ['0xaaa', '0xbbb'], first: 1000 }
    );
  });

  it('resolves a label from duplicate rows sharing one labelhash', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: '[aaa].sub.eth' }]))
      .mockResolvedValueOnce(
        graphQlResponse({
          domains: [
            { labelhash: '0xaaa', labelName: 'alice' },
            { labelhash: '0xaaa', labelName: 'alice' }
          ]
        })
      );

    await expect(lookupDomains(ADDRESS)).resolves.toEqual(['alice.sub.eth']);
  });

  it('resolves every hashed label of a multi-level name', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(
        accountResponse([{ name: '[aaa].[bbb].[ccc].eth' }, { name: '[ccc].eth' }])
      )
      .mockResolvedValueOnce(
        graphQlResponse({
          domains: [
            { labelhash: '0xaaa', labelName: 'alice' },
            { labelhash: '0xccc', labelName: 'aragonid' }
          ]
        })
      );

    await expect(lookupDomains(ADDRESS)).resolves.toEqual([
      'alice.[bbb].aragonid.eth',
      'aragonid.eth'
    ]);
    expect(mockedGraphQlCall.mock.calls[1][2]).toEqual({
      hashes: ['0xaaa', '0xbbb', '0xccc'],
      first: 1000
    });
  });

  it('requests a fixed page size regardless of how many hashes are looked up', async () => {
    const domains = Array.from({ length: 1500 }, (_, index) => ({ name: `[${index}].eth` }));
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

  it('rejects when the domains list is null', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: '[aaa].eth' }]))
      .mockResolvedValueOnce(graphQlResponse({ domains: null }));

    await expect(lookupDomains(ADDRESS)).rejects.toThrow();
  });

  it('rejects when the domains response has no data envelope', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: '[aaa].eth' }]))
      .mockResolvedValueOnce({ data: {} });

    await expect(lookupDomains(ADDRESS)).rejects.toThrow();
  });
});
