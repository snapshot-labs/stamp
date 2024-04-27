import { resolveNames, lookupAddresses } from '../../../src/addressResolvers/farcaster';
import testAddressResolver from './helper';

testAddressResolver({
  name: 'Farcaster',
  lookupAddresses,
  resolveNames,
  validAddress: '0xd1a8Dd23e356B9fAE27dF5DeF9ea025A602EC81e',
  validDomain: 'codingsh.fcast.id',
  blankAddress: '0x0000000000000000000000000000000000000000',
  invalidDomains: ['domain.crypto', 'domain.eth', 'domain.com']
});
