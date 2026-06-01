import { FetchError } from '../../src/addressResolvers/utils';

jest.mock('../../src/lookupDomains/ens', () => ({
  __esModule: true,
  DEFAULT_CHAIN_ID: '1',
  default: jest.fn()
}));
jest.mock('../../src/lookupDomains/shibarium', () => ({
  __esModule: true,
  DEFAULT_CHAIN_ID: '109',
  default: jest.fn()
}));
jest.mock('../../src/lookupDomains/unstoppableDomains', () => ({
  __esModule: true,
  DEFAULT_CHAIN_ID: '146',
  default: jest.fn()
}));

import lookupDomains from '../../src/lookupDomains';
import ens from '../../src/lookupDomains/ens';
import shibarium from '../../src/lookupDomains/shibarium';
import unstoppableDomains from '../../src/lookupDomains/unstoppableDomains';

const VALID_ADDRESS = '0x24F15402C6Bb870554489b2fd2049A85d75B982f';
const CHAINS = ['1', '109', '146'];

describe('lookupDomains - resolver failures', () => {
  it('does not propagate a resolver failure and returns the other resolvers results', async () => {
    (ens as jest.Mock).mockRejectedValue(new FetchError());
    (shibarium as jest.Mock).mockResolvedValue(['boorger.shib']);
    (unstoppableDomains as jest.Mock).mockResolvedValue([]);

    await expect(lookupDomains(VALID_ADDRESS, CHAINS)).resolves.toEqual(['boorger.shib']);
  });

  it('returns an empty array when every resolver fails', async () => {
    (ens as jest.Mock).mockRejectedValue(new FetchError());
    (shibarium as jest.Mock).mockRejectedValue(new FetchError());
    (unstoppableDomains as jest.Mock).mockRejectedValue(new FetchError());

    await expect(lookupDomains(VALID_ADDRESS, CHAINS)).resolves.toEqual([]);
  });
});
