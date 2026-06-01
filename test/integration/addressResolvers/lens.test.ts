import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/lens';

testAddressResolver({
  name: 'Lens',
  lookupAddresses,
  resolveNames,
  validAddress: '0x218F68106128E637fc942C2b1Ed1e3c326125344',
  validDomain: 'fabien.lens',
  blankAddress: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  invalidDomains: ['domain.crypto', 'domain.eth', 'domain.com']
});
