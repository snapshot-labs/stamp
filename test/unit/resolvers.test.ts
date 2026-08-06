import { capture } from '@snapshot-labs/snapshot-sentry';
import resolvers from '../../src/resolvers';
import ens from '../../src/resolvers/ens';
import trustwallet from '../../src/resolvers/trustwallet';
import zapper from '../../src/resolvers/zapper';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

// Stub the resolver functions, keeping each module's real MUTED_ERRORS export:
// what is under test is the wiring in index.ts, not the resolvers themselves.
jest.mock('../../src/resolvers/ens', () => ({
  ...jest.requireActual('../../src/resolvers/ens'),
  __esModule: true,
  default: jest.fn()
}));
jest.mock('../../src/resolvers/trustwallet', () => ({
  ...jest.requireActual('../../src/resolvers/trustwallet'),
  __esModule: true,
  default: jest.fn()
}));
jest.mock('../../src/resolvers/zapper', () => ({
  ...jest.requireActual('../../src/resolvers/zapper'),
  __esModule: true,
  default: jest.fn()
}));

const ensResolver = ens as jest.Mock;
const trustwalletResolver = trustwallet as jest.Mock;
const zapperResolver = zapper as jest.Mock;

const ADDRESS = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';
const IMAGE = Buffer.from('an image');

describe('resolvers - resolver failures', () => {
  it('returns what the resolver returned', async () => {
    ensResolver.mockResolvedValue(IMAGE);

    await expect(resolvers.ens(ADDRESS)).resolves.toBe(IMAGE);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not report a resolver that has no image', async () => {
    ensResolver.mockResolvedValue(false);

    await expect(resolvers.ens(ADDRESS)).resolves.toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it('captures a resolver error, with the resolver and its input as context', async () => {
    const error = new Error('boom');
    ensResolver.mockRejectedValue(error);

    await expect(resolvers.ens(ADDRESS)).resolves.toBe(false);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error, {
      input: { resolver: 'ens', args: [ADDRESS] }
    });
  });

  it('does not capture a silenced error', async () => {
    ensResolver.mockRejectedValue(new Error('Request failed with status=504, no body'));

    await expect(resolvers.ens(ADDRESS)).resolves.toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not capture an error listed in the resolver MUTED_ERRORS', async () => {
    trustwalletResolver.mockRejectedValue(new Error('Request failed with status code 404'));

    await expect(resolvers.trustwallet(ADDRESS, '1')).resolves.toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it('applies MUTED_ERRORS only to the resolver exporting it', async () => {
    const error = new Error('Request failed with status code 404');
    zapperResolver.mockRejectedValue(error);

    await expect(resolvers.zapper(ADDRESS, '1')).resolves.toBe(false);
    expect(capture).toHaveBeenCalledWith(error, {
      input: { resolver: 'zapper', args: [ADDRESS, '1'] }
    });
  });
});
