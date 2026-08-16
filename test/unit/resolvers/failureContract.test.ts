import { capture } from '@snapshot-labs/snapshot-sentry';
import resolvers from '../../../src/resolvers';
import basename from '../../../src/resolvers/basename';
import blockie from '../../../src/resolvers/blockie';
import ens from '../../../src/resolvers/ens';
import lens from '../../../src/resolvers/lens';
import starknet from '../../../src/resolvers/starknet';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({ capture: jest.fn() }));
jest.mock('../../../src/resolvers/ens', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/resolvers/basename', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/resolvers/lens', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/resolvers/starknet', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/resolvers/blockie', () => ({ __esModule: true, default: jest.fn() }));

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

const WRAPPED = [
  ['ens', ens],
  ['basename', basename],
  ['lens', lens],
  ['starknet', starknet]
] as const;

describe('resolvers - failure contract', () => {
  it('answers false when a wrapped resolver throws', async () => {
    (ens as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(resolvers.ens(ADDRESS)).resolves.toBe(false);
  });

  it('does not report a resolver failure', async () => {
    (ens as jest.Mock).mockRejectedValue(new Error('boom'));

    await resolvers.ens(ADDRESS);

    expect(capture).not.toHaveBeenCalled();
  });

  it.each(WRAPPED)('attributes %s bytes sharp cannot process to itself', async (name, fn) => {
    (fn as jest.Mock).mockResolvedValue(Buffer.from('not an image'));

    await expect(resolvers[name](ADDRESS)).resolves.toBe(false);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: { provider: name },
      contexts: { input: { args: [ADDRESS] } }
    });
  });

  // A fallback answering false makes sharp throw on the image route, which has
  // no guard of its own.
  it('leaves the fallback resolvers throwing rather than answering false', async () => {
    const error = new Error('boom');
    (blockie as jest.Mock).mockRejectedValue(error);

    await expect(resolvers.blockie(ADDRESS)).rejects.toBe(error);
  });
});
