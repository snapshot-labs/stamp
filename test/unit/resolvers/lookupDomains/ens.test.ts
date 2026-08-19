import { graphQlCall } from '../../../../src/helpers/graphql';
import lookupDomains from '../../../../src/resolvers/lookupDomains/ens';

jest.mock('../../../../src/helpers/graphql', () => ({
  graphQlCall: jest.fn()
}));

const mockedGraphQlCall = graphQlCall as jest.Mock;
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

function graphQlResponse<T>(data: T) {
  return { data: { data } };
}

function accountResponse(domains: { name: string }[]) {
  return graphQlResponse({ account: { domains, wrappedDomains: [] } });
}

describe('lookupDomains/ens', () => {
  beforeEach(() => {
    mockedGraphQlCall.mockReset();
  });

  it('loads all hashed labels in one registration query', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(
        accountResponse([{ name: '[aaa].eth' }, { name: 'plain.eth' }, { name: '[bbb].eth' }])
      )
      .mockResolvedValue(
        graphQlResponse({
          registrations: [
            { id: '0xbbb', domain: { labelName: '$&' } },
            { id: '0xaaa', domain: { labelName: 'alice' } }
          ]
        })
      );

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(2);
    expect(result).toEqual(['alice.eth', 'plain.eth', '$&.eth']);
    expect(mockedGraphQlCall).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringContaining('registrations(first: $first, where: { id_in: $ids })'),
      { ids: ['0xaaa', '0xbbb'], first: 2 }
    );
  });

  it('requests every registration beyond the subgraph default page size', async () => {
    const domains = Array.from({ length: 101 }, (_, index) => ({ name: `[${index}].eth` }));
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse(domains))
      .mockResolvedValueOnce(graphQlResponse({ registrations: [] }));

    await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall.mock.calls[1][2]).toEqual(
      expect.objectContaining({ first: domains.length })
    );
  });

  it('does not query registrations when no name has a hashed label', async () => {
    mockedGraphQlCall.mockResolvedValueOnce(accountResponse([{ name: 'plain.eth' }]));

    await expect(lookupDomains(ADDRESS)).resolves.toEqual(['plain.eth']);
    expect(mockedGraphQlCall).toHaveBeenCalledTimes(1);
  });

  it('rejects when the registration list is null', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: '[aaa].eth' }]))
      .mockResolvedValueOnce(graphQlResponse({ registrations: null }));

    await expect(lookupDomains(ADDRESS)).rejects.toThrow();
  });

  it('rejects when the registration response has no data envelope', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse([{ name: '[aaa].eth' }]))
      .mockResolvedValueOnce({ data: {} });

    await expect(lookupDomains(ADDRESS)).rejects.toThrow();
  });
});
