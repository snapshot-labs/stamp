import constants from '../../../src/constants.json';
import resolvers, { RESOLVERS } from '../../../src/resolvers/image';

const FALLBACKS = ['blockie', 'jazzicon'];

const NAMES = [
  'blockie',
  'jazzicon',
  'ens',
  'basename',
  'trustwallet',
  'defillama',
  'snapshot',
  'user-cover',
  'space',
  'space-cover',
  'space-logo',
  'space-sx',
  'space-cover-sx',
  'lens',
  'starknet',
  'farcaster'
] as const;

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// The map is built from the registry with Object.fromEntries, which types its
// keys as string on its own. api.ts and the integration helper both index it by
// name, so the keys have to stay a literal union: this annotation stops
// compiling if it widens, which is the failure that would otherwise be silent.
const keysAreALiteralUnion: Exact<keyof typeof resolvers, (typeof NAMES)[number]> = true;

describe('resolvers', () => {
  it('keeps the resolver names a literal union', () => {
    expect(keysAreALiteralUnion).toBe(true);
  });

  it('exposes every registered resolver, in order', () => {
    expect(Object.keys(resolvers)).toEqual([...NAMES]);
  });

  it('puts every resolver a chain can reach under the failure contract', () => {
    const chained = new Set<string>(Object.values(constants.resolvers).flat());
    const contracted = new Set<string>(
      RESOLVERS.filter(entry => entry.failureContract).map(entry => entry.name)
    );

    expect([...chained].filter(name => !contracted.has(name))).toEqual([]);
  });

  it('leaves the fallback resolvers outside it', () => {
    expect(RESOLVERS.filter(entry => !entry.failureContract).map(entry => entry.name)).toEqual(
      FALLBACKS
    );
  });
});
