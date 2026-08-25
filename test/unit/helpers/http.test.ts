import { getUrl, isHttpUrl, isPublicAddress } from '../../../src/helpers/http';

const GATEWAY = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
const CIDV0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const CIDV1 = 'bafkreifnrjhklxvfz3yigmc7c2y3z3p3k3ycidx2s2ecuwx4qw2m3myqi4';

describe('getUrl', () => {
  it('passes a valid absolute URL through unchanged', () => {
    expect(getUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(getUrl('http://example.com/a.png')).toBe('http://example.com/a.png');
  });

  it('rewrites an ipfs:// URI onto the gateway', () => {
    expect(getUrl(`ipfs://${CIDV0}`)).toBe(`https://${GATEWAY}/ipfs/${CIDV0}`);
  });

  it.each([
    ['CIDv0', CIDV0],
    ['CIDv1', CIDV1]
  ])('rewrites a bare %s onto the gateway', (_label, cid) => {
    expect(getUrl(cid)).toBe(`https://${GATEWAY}/ipfs/${cid}`);
  });

  it('returns null for an empty reference', () => {
    expect(getUrl('')).toBeNull();
  });

  it.each([
    ['a scheme with no host', 'http://'],
    ['a URL with a port fetch cannot parse', 'https://example.com:abc/pic.png']
  ])('returns null rather than a URL fetch would reject outright (%s)', (_label, input) => {
    expect(getUrl(input)).toBeNull();
  });

  it('rejects a CAIP identifier the protocol-only check used to accept', () => {
    expect(
      getUrl('http://eip155:1/erc721:0xac5c7493036de60e63eb81c5e9a440b42f47ebf5/5413')
    ).toBeNull();
  });
});

describe('isHttpUrl', () => {
  it.each([
    'https://example.com/avatar.png',
    'http://example.com/avatar.png',
    'https://ik.imagekit.io/avatar.png',
    'https://gw.ipfs-lens.dev/ipfs/avatar.png',
    'https://wrpcd.net/cdn-cgi/image/avatar.png',
    'https://metadata.ens.domains/mainnet/avatar/vitalik.eth',
    'https://assets.coingecko.com/coins/images/1/large/bitcoin.png'
  ])('accepts %s', url => {
    expect(isHttpUrl(url)).toBe(true);
  });

  it.each([
    ['a relative path', '/BEB.jpg'],
    ['a bare string', 'not a url'],
    ['a non-http scheme', 'ftp://example.com/avatar.png'],
    [
      'a CAIP identifier mistaken for a URL, on chain id 1',
      'http://eip155:1/erc721:https://etherscan.io/address/0xac5c7493036de60e63eb81c5e9a440b42f47ebf5/5413'
    ],
    [
      'the same CAIP identifier on Base, whose chain id is not a blocked port',
      'http://eip155:8453/erc721:0xac5c7493036de60e63eb81c5e9a440b42f47ebf5/5413'
    ],
    [
      'the same CAIP identifier on Optimism, whose chain id is not a blocked port',
      'http://eip155:10/erc721:0xac5c7493036de60e63eb81c5e9a440b42f47ebf5/5413'
    ],
    [
      'the same CAIP identifier on Arbitrum, whose chain id is not a blocked port',
      'http://eip155:42161/erc721:0xac5c7493036de60e63eb81c5e9a440b42f47ebf5/5413'
    ]
  ])('rejects %s (%s)', (_, url) => {
    expect(isHttpUrl(url)).toBe(false);
  });

  it('accepts a URL naming a port fetch itself refuses, since enforcing that is fetch()s job', () => {
    expect(isHttpUrl('http://example.com:25/avatar.png')).toBe(true);
  });

  it('accepts a URL with a normal non-default port', () => {
    expect(isHttpUrl('https://example.com:8443/avatar.png')).toBe(true);
  });
});

describe('isPublicAddress', () => {
  it.each([
    ['127.0.0.1', 'IPv4 loopback'],
    ['10.0.0.1', 'IPv4 private (RFC1918)'],
    ['172.16.0.1', 'IPv4 private (RFC1918)'],
    ['192.168.1.1', 'IPv4 private (RFC1918)'],
    ['169.254.169.254', 'IPv4 link-local, incl. the cloud metadata address'],
    ['100.64.0.1', 'IPv4 carrier-grade NAT'],
    ['0.0.0.0', 'IPv4 unspecified'],
    ['255.255.255.255', 'IPv4 broadcast'],
    ['::1', 'IPv6 loopback'],
    ['::', 'IPv6 unspecified'],
    ['fe80::1', 'IPv6 link-local'],
    ['fc00::1', 'IPv6 unique-local'],
    ['::ffff:127.0.0.1', 'IPv4-mapped IPv6 loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped IPv6 metadata address']
  ])('rejects %s (%s)', address => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    ['8.8.8.8', 'IPv4 unicast'],
    ['93.184.216.34', 'IPv4 unicast'],
    ['2001:4860:4860::8888', 'IPv6 unicast'],
    ['::ffff:8.8.8.8', 'IPv4-mapped IPv6 unicast']
  ])('allows %s (%s)', address => {
    expect(isPublicAddress(address)).toBe(true);
  });
});
