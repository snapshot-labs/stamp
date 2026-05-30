import testAddressResolver from './helper';
import { lookupAddresses } from '../../../src/addressResolvers/snapshot';

testAddressResolver({
  name: 'Snapshot',
  lookupAddresses,
  resolveNames: null,
  validAddress: '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7',
  validDomain: 'less',
  blankAddress: '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1',
  invalidDomains: ['']
});
