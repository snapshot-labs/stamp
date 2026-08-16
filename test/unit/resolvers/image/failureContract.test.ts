import { capture } from '@snapshot-labs/snapshot-sentry';
import resolvers from '../../../../src/resolvers/image';
import basename from '../../../../src/resolvers/image/basename';
import blockie from '../../../../src/resolvers/image/blockie';
import ens from '../../../../src/resolvers/image/ens';
import lens from '../../../../src/resolvers/image/lens';
import {
  resolveSpaceCover,
  resolveSpaceLogo,
  resolveUserCover
} from '../../../../src/resolvers/image/snapshot';
import { resolveCover } from '../../../../src/resolvers/image/space-sx';
import starknet from '../../../../src/resolvers/image/starknet';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({ capture: jest.fn() }));
jest.mock('../../../../src/resolvers/image/ens', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../../src/resolvers/image/basename', () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock('../../../../src/resolvers/image/lens', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../../src/resolvers/image/starknet', () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock('../../../../src/resolvers/image/blockie', () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock('../../../../src/resolvers/image/snapshot', () => ({
  __esModule: true,
  resolveUserAvatar: jest.fn(),
  resolveUserCover: jest.fn(),
  resolveSpaceAvatar: jest.fn(),
  resolveSpaceCover: jest.fn(),
  resolveSpaceLogo: jest.fn()
}));
jest.mock('../../../../src/resolvers/image/space-sx', () => ({
  __esModule: true,
  resolveAvatar: jest.fn(),
  resolveCover: jest.fn()
}));

const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

const RESIZED = [
  ['ens', ens],
  ['basename', basename],
  ['lens', lens],
  ['starknet', starknet]
] as const;

const UNRESIZED = [
  ['user-cover', resolveUserCover],
  ['space-cover', resolveSpaceCover],
  ['space-logo', resolveSpaceLogo],
  ['space-cover-sx', resolveCover]
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

  it.each(RESIZED)('attributes %s bytes sharp cannot process to itself', async (name, fn) => {
    (fn as jest.Mock).mockResolvedValue(Buffer.from('not an image'));

    await expect(resolvers[name](ADDRESS)).resolves.toBe(false);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: { provider: name },
      contexts: { input: { args: [ADDRESS] } }
    });
  });

  it.each(UNRESIZED)('answers false when %s throws', async (name, fn) => {
    (fn as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(resolvers[name](ADDRESS)).resolves.toBe(false);
  });

  it.each(UNRESIZED)('serves %s at the size the upstream sent', async (name, fn) => {
    const bytes = Buffer.from('not an image');
    (fn as jest.Mock).mockResolvedValue(bytes);

    await expect(resolvers[name](ADDRESS)).resolves.toBe(bytes);
    expect(capture).not.toHaveBeenCalled();
  });

  it('leaves the fallback resolvers throwing rather than answering false', async () => {
    const error = new Error('boom');
    (blockie as jest.Mock).mockRejectedValue(error);

    await expect(resolvers.blockie(ADDRESS)).rejects.toBe(error);
  });
});
