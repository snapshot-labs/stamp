import { DNSConnect } from '@webinterop/dns-connect';
import { dnsConnect } from '../../../src/helpers/dns';

jest.mock('@webinterop/dns-connect', () => ({
  DNSConnect: jest.fn()
}));

const mockedDNSConnect = DNSConnect as unknown as jest.Mock;

const ONE_DAY = 86400;

function installedCache(forwarderDomain: string) {
  dnsConnect(forwarderDomain);

  return mockedDNSConnect.mock.calls.at(-1)[0].caching.cacheProvider;
}

describe('helpers/dns', () => {
  it('caches an answer without arming a timer for its expiry', async () => {
    const cache = installedCache('no-timer');
    const timers = jest.spyOn(global, 'setTimeout');

    await cache.set('_tld:shib', 'true', ONE_DAY);

    expect(timers).not.toHaveBeenCalled();
    await expect(cache.get('_tld:shib')).resolves.toBe('true');
  });

  it('stops answering once the TTL has passed', async () => {
    const cache = installedCache('expiry');

    await cache.set('_tld:shib', 'true', ONE_DAY);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + (ONE_DAY + 1) * 1e3);

    await expect(cache.get('_tld:shib')).resolves.toBeUndefined();
  });

  it('does not cache a name the resolver could not fill', async () => {
    const cache = installedCache('empty-answer');

    await cache.set('missing.shib:BONE', '', ONE_DAY);

    await expect(cache.get('missing.shib:BONE')).resolves.toBeUndefined();
  });

  it('answers a later client from what an earlier one cached', async () => {
    const first = installedCache('reused');
    const second = installedCache('reused');

    await first.set('_tld:shib', 'false', ONE_DAY);

    await expect(second.get('_tld:shib')).resolves.toBe('false');
  });

  it('does not let one forwarder domain answer from another', async () => {
    const mainnet = installedCache('mainnet');
    const testnet = installedCache('testnet');

    await mainnet.set('alice.shib:BONE', '0xmainnet', ONE_DAY);

    await expect(testnet.get('alice.shib:BONE')).resolves.toBeUndefined();
  });
});
