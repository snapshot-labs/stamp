import { capture } from '@snapshot-labs/snapshot-sentry';
import { lookupAddresses } from '../../src/addressResolvers';
import * as basename from '../../src/addressResolvers/basename';
import * as ens from '../../src/addressResolvers/ens';
import * as gwei from '../../src/addressResolvers/gwei';
import * as lens from '../../src/addressResolvers/lens';
import * as shibarium from '../../src/addressResolvers/shibarium';
import * as snapshotResolver from '../../src/addressResolvers/snapshot';
import * as spaceId from '../../src/addressResolvers/spaceId';
import * as starknet from '../../src/addressResolvers/starknet';
import * as unstoppableDomains from '../../src/addressResolvers/unstoppableDomains';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

// Run the resolver fan-out on every call, without a redis round trip.
jest.mock('../../src/addressResolvers/cache', () => ({
  __esModule: true,
  default: (input: string[], callback: (input: string[]) => any) => callback(input),
  clear: jest.fn()
}));

const RESOLVERS = [
  snapshotResolver,
  ens,
  basename,
  unstoppableDomains,
  lens,
  starknet,
  shibarium,
  spaceId,
  gwei
];

const ADDRESS = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';

beforeEach(() => {
  RESOLVERS.forEach(resolver => {
    jest.spyOn(resolver, 'lookupAddresses').mockResolvedValue({});
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('addressResolvers - input normalization', () => {
  const STARKNET_ADDRESS = '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a';
  const OUT_OF_RANGE = '0x07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';

  it('never sends an out-of-range 64-char hex value to a resolver', async () => {
    await expect(lookupAddresses([OUT_OF_RANGE])).resolves.toEqual({});
    expect(snapshotResolver.lookupAddresses).not.toHaveBeenCalled();
  });

  it('still sends a valid starknet address', async () => {
    await expect(lookupAddresses([STARKNET_ADDRESS])).resolves.toEqual({});
    expect(snapshotResolver.lookupAddresses).toHaveBeenCalledWith([STARKNET_ADDRESS]);
  });
});

describe('addressResolvers - resolver failures', () => {
  it('captures a resolver error, with the input as context', async () => {
    const error = new Error('boom');
    jest.spyOn(ens, 'lookupAddresses').mockRejectedValue(error);

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Ens' },
      contexts: { input: { lookupAddresses: [ADDRESS] } }
    });
  });

  it('does not capture a silenced error', async () => {
    jest
      .spyOn(ens, 'lookupAddresses')
      .mockRejectedValue(new Error('Request failed with status=504, no body'));

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({});
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not capture an error listed in the resolver MUTED_ERRORS', async () => {
    jest
      .spyOn(lens, 'lookupAddresses')
      .mockRejectedValue(new Error('Request failed with status code 503'));

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({});
    expect(capture).not.toHaveBeenCalled();
  });

  it('applies MUTED_ERRORS only to the resolver exporting it', async () => {
    const error = new Error('Request failed with status code 503');
    jest.spyOn(ens, 'lookupAddresses').mockRejectedValue(error);

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Ens' },
      contexts: { input: { lookupAddresses: [ADDRESS] } }
    });
  });

  it('keeps the other resolvers results when one fails', async () => {
    jest.spyOn(ens, 'lookupAddresses').mockRejectedValue(new Error('boom'));
    jest.spyOn(shibarium, 'lookupAddresses').mockResolvedValue({ [ADDRESS]: 'boorger.shib' });

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({ [ADDRESS]: 'boorger.shib' });
  });
});
