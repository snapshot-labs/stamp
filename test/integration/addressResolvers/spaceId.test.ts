import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/spaceId';
import testAddressResolver from './helper';

testAddressResolver({
  name: 'Space ID',
  lookupAddresses,
  resolveNames,
  validAddress: '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6',
  validDomain: 'boorger.bnb',
  blankAddress: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
  invalidDomains: ['domain.crypto', 'domain.eth', 'domain.com', 'inexistent-domain-for-test.bnb']
});
