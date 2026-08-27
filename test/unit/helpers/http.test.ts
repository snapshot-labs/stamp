import { getUrl } from '../../../src/helpers/http';

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
