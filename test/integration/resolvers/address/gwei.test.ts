import testAddressResolver from './helper';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/gwei';

testAddressResolver({
  name: 'Gwei Name Service',
  lookupAddresses,
  resolveNames,
  validAddress: '0xC04689227Fa24785609B1174698DBe481437f1A3',
  validDomain: 'donnoh.gwei',
  blankAddress: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
  invalidDomains: ['domain.crypto', 'domain.eth', 'domain.com', 'inexistent-domain-for-test.gwei']
});
