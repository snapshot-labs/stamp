import { getBaseCacheKey, getCacheKey, parseQuery } from '../../../src/helpers/api';
import { ResolverType } from '../../../src/helpers/types';

describe('parseQuery()', () => {
  it('is synchronous', () => {
    const result = parseQuery('0xabc', 'avatar', {});
    expect(result).not.toBeInstanceOf(Promise);
  });

  it.each([
    ['plain address', '0xABC', { address: '0xabc', network: '1', networkId: undefined }],
    ['shortName:address', 'matic:0xABC', { address: '0xabc', network: '137', networkId: 'matic' }],
    [
      'unknown shortName:address falls back to mainnet',
      'bogus:0xABC',
      { address: '0xabc', network: '1', networkId: 'bogus' }
    ],
    [
      'chainId:network:address',
      '1:137:0xABC',
      { address: '0xabc', network: '137', networkId: 'matic' }
    ],
    [
      'unknown chainId:network:address falls back to eth',
      '1:999999999999:0xABC',
      { address: '0xabc', network: '999999999999', networkId: 'eth' }
    ],
    [
      'multi-segment did is treated as an opaque id, not stripped',
      'did:pkh:eip155:1:0xABC',
      { address: 'did:pkh:eip155:1:0xabc', network: '1', networkId: undefined }
    ],
    [
      'whitespace around the id is trimmed',
      '  0xABC  ',
      { address: '0xabc', network: '1', networkId: undefined }
    ],
    [
      'whitespace-padded shortName:address still resolves the network',
      ' matic:0xABC',
      { address: '0xabc', network: '137', networkId: 'matic' }
    ],
    [
      'whitespace inside a shortName:address id is trimmed per chunk',
      'matic :0xABC',
      { address: '0xabc', network: '137', networkId: 'matic' }
    ],
    [
      'whitespace inside a chainId:network:address id is trimmed per chunk',
      '1: 137 :0xABC',
      { address: '0xabc', network: '137', networkId: 'matic' }
    ],
    [
      'uppercase shortName:address is normalized before the network lookup',
      'MATIC:0xABC',
      { address: '0xabc', network: '137', networkId: 'matic' }
    ]
  ])('%s', (_name, id, expected) => {
    const result = parseQuery(id, 'avatar', {});
    expect(result.address).toBe(expected.address);
    expect(result.network).toBe(expected.network);
    expect(result.networkId).toBe(expected.networkId);
  });
});

describe('parseQuery() query params', () => {
  it.each([
    ['defaults', 'avatar', {}, { w: 64, h: 64, fallback: 'blockie' }],
    ['s sets both sides', 'avatar', { s: '32' }, { w: 32, h: 32 }],
    ['s keeps parseInt leniency', 'avatar', { s: '32px' }, { w: 32, h: 32 }],
    ['s given twice uses the first', 'avatar', { s: ['1', '2'] }, { w: 1, h: 1 }],
    ['s out of range falls back', 'avatar', { s: '501' }, { w: 64, h: 64 }],
    ['cover types allow a larger s', 'space-cover', { s: '1500' }, { w: 1500, h: 1500 }],
    ['non-numeric s falls back', 'avatar', { s: 'abc' }, { w: 64, h: 64 }],
    ['s of 0 falls back', 'avatar', { s: '0' }, { w: 64, h: 64 }],
    ['empty w falls back to s', 'avatar', { s: '32', w: '' }, { w: 32, h: 32 }],
    ['w overrides s', 'avatar', { s: '32', w: '100' }, { w: 100, h: 32 }],
    [
      'invalid w falls back to the default, not s',
      'avatar',
      { s: '32', w: '999' },
      { w: 64, h: 32 }
    ],
    ['fb jazzicon', 'avatar', { fb: 'jazzicon' }, { fallback: 'jazzicon' }],
    ['unknown fb falls back', 'avatar', { fb: 'JAZZICON' }, { fallback: 'blockie' }],
    ['known fit', 'avatar', { fit: 'cover' }, { fit: 'cover' }],
    ['unknown fit is dropped', 'avatar', { fit: 'bogus' }, { fit: undefined }],
    ['cb is passed through as is', 'avatar', { cb: ['1', '2'] }, { cb: ['1', '2'] }],
    ['known resolver', 'avatar', { resolver: 'ens' }, { resolver: 'ens' }],
    ['empty resolver is no override', 'avatar', { resolver: '' }, { resolver: undefined }]
  ])('%s', (_name, type, query, expected) => {
    expect(parseQuery('0xabc', type as ResolverType, query)).toMatchObject(expected);
  });

  it.each([
    ['unknown resolver', 'avatar', { resolver: 'garbage' }],
    ['resolver of another type', 'space-cover', { resolver: 'ens' }],
    ['repeated resolver', 'avatar', { resolver: ['ens', 'lens'] }]
  ])('throws on %s', (_name, type, query) => {
    expect(() => parseQuery('0xabc', type as ResolverType, query)).toThrow('invalid resolvers');
  });
});

describe('cache keys', () => {
  const keys = (id: string) => {
    const query = parseQuery(id, 'avatar', { s: '32' });
    return [getBaseCacheKey('avatar', query), getCacheKey({ type: 'avatar', ...query })];
  };

  it('keeps plain address keys unchanged', () => {
    expect(keys('0xabc')).toEqual([
      '0f28547f168ecdec9ec886daaf74ed8f108c1228bec8d938cf74c4e553c1850f',
      'cb1cf691bcfa6349821e0c03793f89810f6f611af376f7252c7c22d021b206d1'
    ]);
  });

  it('shares the default offchain network key with the plain address', () => {
    expect(keys('s:0xabc')).toEqual(keys('0xabc'));
  });

  it('shares a key between shortName and chainId forms of one networkId', () => {
    expect(keys('1:1:0xabc')).toEqual(keys('eth:0xabc'));
  });

  it.each(['eth:0xabc', 'bogus:0xabc'])('separates %s from the plain address', id => {
    const [plainBase, plainResized] = keys('0xabc');
    const [base, resized] = keys(id);
    expect(base).not.toBe(plainBase);
    expect(resized).not.toBe(plainResized);
  });

  it.each([
    ['pol', 'matic'],
    ['sep', 's-tn']
  ])('separates %s and %s, which share a chainId', (a, b) => {
    expect(keys(`${a}:0xabc`)).not.toEqual(keys(`${b}:0xabc`));
  });
});
