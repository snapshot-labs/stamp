import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/basename';

testAddressResolver({
  name: 'Basename',
  lookupAddresses,
  resolveNames,
  validAddress: '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9',
  validDomain: 'jesse.base.eth',
  blankAddress: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  invalidDomains: ['domain.crypto', 'domain.lens', 'vitalik.eth']
});
