import { parseQuery } from '../../../src/helpers/api';

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
      'did: is treated as a shortName, not stripped',
      'did:0xABC',
      { address: '0xabc', network: '1', networkId: 'did' }
    ],
    [
      'whitespace around the id is trimmed',
      '  0xABC  ',
      { address: '0xabc', network: '1', networkId: undefined }
    ]
  ])('%s', (_name, id, expected) => {
    const result = parseQuery(id, 'avatar', {});
    expect(result.address).toBe(expected.address);
    expect(result.network).toBe(expected.network);
    expect(result.networkId).toBe(expected.networkId);
  });
});
