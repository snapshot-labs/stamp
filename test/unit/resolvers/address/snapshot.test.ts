import { lookupAddresses } from '../../../../src/resolvers/address/snapshot';
import { jsonResponse, mockGlobalFetch } from '../../../helpers/fetch';

const mockedFetch = mockGlobalFetch();

const ADDRESS = '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a';

describe('Snapshot address resolver', () => {
  it('keeps only the users having a name', async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse({
        data: {
          users: [
            { id: ADDRESS, name: 'Less' },
            { id: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1', name: null }
          ]
        }
      })
    );

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({ [ADDRESS]: 'Less' });
  });
});
