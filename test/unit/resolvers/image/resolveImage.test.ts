import { ZodError } from 'zod';
import constants from '../../../../src/constants.json';
import resolvers, { resolveImage } from '../../../../src/resolvers/image';
import cache from '../../../../src/resolvers/image/cache';

jest.mock('../../../../src/resolvers/image/cache', () => ({
  __esModule: true,
  default: jest.fn(),
  clear: jest.fn()
}));

const ADDRESS = '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc';
const [RESOLVER] = constants.resolvers.avatar;

let spies: [string, jest.SpyInstance][];

beforeEach(() => {
  (cache as jest.Mock).mockReset();
  spies = (Object.keys(resolvers) as (keyof typeof resolvers)[])
    .filter(name => name !== 'blockie')
    .map(name => [name, jest.spyOn(resolvers, name).mockResolvedValue(false)]);
});

afterEach(() => spies.forEach(([, spy]) => spy.mockRestore()));

describe('resolveImage', () => {
  it('rejects an unknown resolver override before touching the cache', async () => {
    await expect(resolveImage('avatar', ADDRESS, { resolver: 'garbage' })).rejects.toBeInstanceOf(
      ZodError
    );
    expect(cache).not.toHaveBeenCalled();
  });

  it('returns the cached or resolved image as not a fallback', async () => {
    const image = Buffer.from('image');
    (cache as jest.Mock).mockResolvedValue(image);

    expect(await resolveImage('avatar', ADDRESS, {})).toEqual({ image, isFallback: false });
    expect(cache).toHaveBeenCalledWith('avatar', expect.any(Object), expect.any(Function), false);
  });

  it('returns the fallback image when nothing resolves', async () => {
    (cache as jest.Mock).mockResolvedValue(false);

    expect(await resolveImage('avatar', ADDRESS, {})).toEqual({
      image: expect.any(Buffer),
      isFallback: true
    });
  });

  it('bypasses the cache and runs only the requested resolver under an override', async () => {
    (cache as jest.Mock).mockImplementation((_type, _query, callback) => callback());

    await resolveImage('avatar', ADDRESS, { resolver: RESOLVER });

    expect(cache).toHaveBeenCalledWith('avatar', expect.any(Object), expect.any(Function), true);
    expect(spies.filter(([, spy]) => spy.mock.calls.length).map(([name]) => name)).toEqual([
      RESOLVER
    ]);
  });
});
