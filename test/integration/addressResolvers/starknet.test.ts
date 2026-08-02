import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/starknet';

testAddressResolver({
  name: 'Starknet',
  lookupAddresses,
  resolveNames,
  validAddress: '0x061b6c0a78f9edf13cea17b50719f3344533fadd470b8cb29c2b4318014f52d3',
  validDomain: 'fricoben.stark',
  blankAddress: '0x040f81578c2ab498c1252fdebdf1ed5dc083906dc7b9e3552c362db1c7c23a02',
  invalidDomains: ['domain.crypto', 'domain.eth', 'domain.com']
});
