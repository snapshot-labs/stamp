import { lookupAddresses } from '../../../../src/resolvers/address/snapshot';

const originalFetch = global.fetch;
const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof global.fetch;

const ADDRESS = '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a';

afterAll(() => {
  global.fetch = originalFetch;
});

describe('Snapshot address resolver', () => {
  it('keeps only the users having a name', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          users: [
            { id: ADDRESS, name: 'Less' },
            { id: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1', name: null }
          ]
        }
      })
    });

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({ [ADDRESS]: 'Less' });
  });
});
