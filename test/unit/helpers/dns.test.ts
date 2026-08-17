import { DNSConnect } from '@webinterop/dns-connect';
import { dnsConnect } from '../../../src/helpers/dns';

jest.mock('@webinterop/dns-connect', () => ({
  DNSConnect: jest.fn()
}));

const mockedDNSConnect = DNSConnect as unknown as jest.Mock;

// The one-day TLD entry is what used to keep the process alive, so that is the TTL
// this asks about.
const ONE_DAY = 86400;

function installedCache() {
  dnsConnect('vana');

  return mockedDNSConnect.mock.calls[0][0].caching.cacheProvider;
}

describe('helpers/dns', () => {
  it('caches an answer without arming a timer for its expiry', async () => {
    const cache = installedCache();
    const timers = jest.spyOn(global, 'setTimeout');

    await cache.set('_tld:shib', 'true', ONE_DAY);

    expect(timers).not.toHaveBeenCalled();
    await expect(cache.get('_tld:shib')).resolves.toBe('true');
  });

  it('stops answering once the TTL has passed', async () => {
    const cache = installedCache();

    await cache.set('_tld:shib', 'true', ONE_DAY);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + (ONE_DAY + 1) * 1e3);

    await expect(cache.get('_tld:shib')).resolves.toBeUndefined();
  });
});
