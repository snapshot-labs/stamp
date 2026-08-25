import { getUrl, isHttpUrl } from '../../../src/helpers/http';

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
});

describe('isHttpUrl', () => {
  it.each(['https://example.com/avatar.png', 'http://example.com/avatar.png'])(
    'accepts %s',
    url => {
      expect(isHttpUrl(url)).toBe(true);
    }
  );

  it.each([
    ['a relative path', '/BEB.jpg'],
    ['a bare string', 'not a url'],
    ['a non-http scheme', 'ftp://example.com/avatar.png'],
    [
      'a CAIP identifier mistaken for a URL, with a blocked port',
      'http://eip155:1/erc721:https://etherscan.io/address/0xac5c7493036de60e63eb81c5e9a440b42f47ebf5/5413'
    ],
    [
      'an explicitly blocked port on an otherwise well-formed URL',
      'http://example.com:25/avatar.png'
    ]
  ])('rejects %s (%s)', (_, url) => {
    expect(isHttpUrl(url)).toBe(false);
  });

  it('accepts a URL with a normal non-default port', () => {
    expect(isHttpUrl('https://example.com:8443/avatar.png')).toBe(true);
  });

  // Every port Node's fetch() itself refuses (https://fetch.spec.whatwg.org/#port-blocking),
  // brute-forced against a live fetch() on this runtime rather than copied from the spec text.
  it('rejects every port fetch() itself refuses', () => {
    const forbidden = [
      1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
      103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
      512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
      995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
      6669, 6679, 6697, 10080
    ];

    const stillAccepted = forbidden.filter(port => isHttpUrl(`http://example.com:${port}/x`));

    expect(stillAccepted).toEqual([]);
  });
});
