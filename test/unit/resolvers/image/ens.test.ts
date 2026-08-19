import { getProvider } from '../../../../src/helpers/provider';
import resolve from '../../../../src/resolvers/image/ens';

jest.mock('../../../../src/helpers/provider', () => ({ getProvider: jest.fn() }));
jest.mock('../../../../src/resolvers/address', () => ({ lookupAddresses: jest.fn() }));

const STARKNET_ADDRESS = '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a';
const INVALID_NAMES = [STARKNET_ADDRESS, 'nodot', 'a..b'];
const VALID_NAMES = [
  ['vitalik.eth', 'vitalik.eth'],
  ['foo.xyz', 'foo.xyz'],
  ['ⓥⓘⓣⓐⓛⓘⓚ.eth', 'vitalik.eth']
] as const;

const getResolver = jest.fn();

beforeEach(() => {
  getResolver.mockReset();
  (getProvider as jest.Mock).mockReturnValue({ getResolver });
});

describe('ens image resolver', () => {
  it.each(INVALID_NAMES)('skips the provider for %s', async input => {
    await expect(resolve(input)).resolves.toBe(false);
    expect(getResolver).not.toHaveBeenCalled();
  });

  it.each(VALID_NAMES)('asks the provider for %s', async (input, normalized) => {
    getResolver.mockResolvedValue(null);

    await expect(resolve(input)).resolves.toBe(false);
    expect(getResolver).toHaveBeenCalledWith(normalized);
  });

  it('preserves provider failures for the outer failure contract', async () => {
    const error = new Error('provider unavailable');
    getResolver.mockRejectedValue(error);

    await expect(resolve('vitalik.eth')).rejects.toBe(error);
  });
});
