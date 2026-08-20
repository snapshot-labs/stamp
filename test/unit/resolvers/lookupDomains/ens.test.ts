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

function accountResponse(domains: { name: string }[], wrappedDomains: { name: string }[] = []) {
  return graphQlResponse({ account: { domains, wrappedDomains } });
}

function namedDomains(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({ name: `${prefix}${index}.eth` }));
}

describe('lookupDomains/ens', () => {
  beforeEach(() => {
    mockedGraphQlCall.mockReset();
  });

  it('bounds both nested domain lists with an explicit page size', async () => {
    mockedGraphQlCall.mockResolvedValueOnce(accountResponse([{ name: 'plain.eth' }]));

    await lookupDomains(ADDRESS);

    const [, query, variables] = mockedGraphQlCall.mock.calls[0];
    expect(query).toContain('domains(first: $first, skip: $domainsSkip)');
    expect(query).toContain('wrappedDomains(first: $first, skip: $wrappedDomainsSkip)');
    expect(variables).toEqual({
      id: ADDRESS.toLowerCase(),
      first: 1000,
      domainsSkip: 0,
      wrappedDomainsSkip: 0
    });
  });

  it('pages until both nested lists are exhausted', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse(namedDomains(1000, 'a'), namedDomains(1000, 'w')))
      .mockResolvedValueOnce(accountResponse(namedDomains(1, 'b')));

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(2);
    expect(mockedGraphQlCall.mock.calls[1][2]).toEqual(
      expect.objectContaining({ domainsSkip: 1000, wrappedDomainsSkip: 1000 })
    );
    expect(result).toHaveLength(2001);
    expect(result).toContain('b0.eth');
  });

  it('keeps paging while either list alone is still full', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse(namedDomains(1000, 'a'), namedDomains(2, 'w')))
      .mockResolvedValueOnce(accountResponse(namedDomains(4, 'b')));

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(2);
    expect(mockedGraphQlCall.mock.calls[1][2]).toEqual(
      expect.objectContaining({ domainsSkip: 1000, wrappedDomainsSkip: 2 })
    );
    expect(result).toHaveLength(1006);
  });

  it('advances each skip cumulatively across pages', async () => {
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse(namedDomains(1000, 'a')))
      .mockResolvedValueOnce(accountResponse(namedDomains(1000, 'b')))
      .mockResolvedValueOnce(accountResponse(namedDomains(3, 'c')));

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(3);
    expect(mockedGraphQlCall.mock.calls.map(call => call[2].domainsSkip)).toEqual([0, 1000, 2000]);
    expect(result).toHaveLength(2003);
  });

  it('stops requesting once the page cap is reached', async () => {
    mockedGraphQlCall.mockResolvedValue(accountResponse(namedDomains(1000, 'a')));

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(10);
    expect(result).toHaveLength(10000);
  });

  it('splits the registration lookup into subgraph-sized chunks', async () => {
    const domains = Array.from({ length: 1001 }, (_, index) => ({ name: `[${index}].eth` }));
    mockedGraphQlCall
      .mockResolvedValueOnce(accountResponse(domains))
      .mockResolvedValueOnce(graphQlResponse({ registrations: [] }))
      .mockResolvedValueOnce(
        graphQlResponse({ registrations: [{ id: '0x1000', domain: { labelName: 'last' } }] })
      );

    const result = await lookupDomains(ADDRESS);

    expect(mockedGraphQlCall).toHaveBeenCalledTimes(3);
    expect(mockedGraphQlCall.mock.calls[1][2].first).toBe(1000);
    expect(mockedGraphQlCall.mock.calls[1][2].ids).toHaveLength(1000);
    expect(mockedGraphQlCall.mock.calls[2][2]).toEqual({ ids: ['0x1000'], first: 1 });
    expect(result).toContain('last.eth');
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
