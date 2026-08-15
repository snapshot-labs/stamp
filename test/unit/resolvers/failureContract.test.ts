import { capture } from '@snapshot-labs/snapshot-sentry';
import resolvers from '../../../src/resolvers';
import blockie from '../../../src/resolvers/blockie';
import ens from '../../../src/resolvers/ens';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({ capture: jest.fn() }));
jest.mock('../../../src/resolvers/ens', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/resolvers/blockie', () => ({ __esModule: true, default: jest.fn() }));

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

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

  it('reports bytes sharp cannot process, and still answers false', async () => {
    (ens as jest.Mock).mockResolvedValue(Buffer.from('not an image'));

    await expect(resolvers.ens(ADDRESS)).resolves.toBe(false);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  // api.ts hands the fallback resolver's result straight to resize() with no
  // guard of its own, so a fallback answering false would make sharp throw into
  // the unguarded image route (#495). Until that route is fixed the fallbacks
  // have to stay outside the false-on-failure contract.
  it('leaves the fallback resolvers throwing rather than answering false', async () => {
    const error = new Error('boom');
    (blockie as jest.Mock).mockRejectedValue(error);

    await expect(resolvers.blockie(ADDRESS)).rejects.toBe(error);
  });
});
