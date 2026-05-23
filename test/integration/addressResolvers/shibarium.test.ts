import { lookupAddresses, resolveNames } from '../../../src/addressResolvers/shibarium';
import testAddressResolver from './helper';

testAddressResolver({
  name: 'Shibarium',
  lookupAddresses,
  resolveNames,
  validAddress: '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6',
  validDomain: 'boorger.shib',
  blankAddress: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
  invalidDomains: ['domain.crypto', 'domain.eth', 'domain.com', 'inexistent-domain-for-test.shib']
});

describe('Shibarium lookupAddresses() input filtering', () => {
  // 64-hex Starknet-shaped addresses exceed the 63-octet DNS label limit when
  // combined with the `0x` prefix, which caused @webinterop/dns-connect to throw.
  // See STAMP-36.
  it('drops non-EVM (Starknet-shaped) addresses without calling DNS', async () => {
    const starknetAddress = '0x03fe982f868b8fa9077b26e318a46ecfd61685859664f192b7a96aaf3ab75843';
    await expect(lookupAddresses([starknetAddress])).resolves.toEqual({});
  });
});
