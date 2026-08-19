import { capture } from '@snapshot-labs/snapshot-sentry';
import { namehash } from 'viem/ens';
import { EMPTY_ADDRESS } from '../../../src/helpers/address';
import * as provider from '../../../src/helpers/provider';
import { lookupAddresses, resolveNames } from '../../../src/resolvers/address';
import * as basename from '../../../src/resolvers/address/basename';
import * as ens from '../../../src/resolvers/address/ens';
import * as gwei from '../../../src/resolvers/address/gwei';
import * as lens from '../../../src/resolvers/address/lens';
import * as shibarium from '../../../src/resolvers/address/shibarium';
import * as snapshotResolver from '../../../src/resolvers/address/snapshot';
import * as spaceId from '../../../src/resolvers/address/spaceId';
import * as starknet from '../../../src/resolvers/address/starknet';
import * as unstoppableDomains from '../../../src/resolvers/address/unstoppableDomains';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

// Run the resolver fan-out on every call, without a redis round trip.
jest.mock('../../../src/resolvers/address/cache', () => ({
  ...jest.requireActual('../../../src/resolvers/address/cache'),
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

describe('address resolvers - input normalization', () => {
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

describe('address resolvers - resolver failures', () => {
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

  it.each(RESOLVERS.map(resolver => [resolver.NAME, resolver] as const))(
    'attributes a %s failure to itself',
    async (name, resolver) => {
      const error = new Error('boom');
      jest.spyOn(resolver, 'lookupAddresses').mockRejectedValue(error);

      await lookupAddresses([ADDRESS]);

      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith(error, {
        tags: { provider: name },
        contexts: { input: { lookupAddresses: [ADDRESS] } }
      });
    }
  );

  it('keeps the other resolvers results when one fails', async () => {
    jest.spyOn(ens, 'lookupAddresses').mockRejectedValue(new Error('boom'));
    jest.spyOn(shibarium, 'lookupAddresses').mockResolvedValue({ [ADDRESS]: 'boorger.shib' });

    await expect(lookupAddresses([ADDRESS])).resolves.toEqual({ [ADDRESS]: 'boorger.shib' });
  });
});

describe('address resolvers - invalid Space ID labels', () => {
  const HANDLE = 'boorger.bnb';
  const EMOJI_HANDLE = '🩷🩷🩷.bnb';
  const INVALID_HANDLES = ['foo!.bnb', 'a..bnb', '.bnb', 'foo_bar.bnb', 'ｆｏｏ.bnb'];
  const HASH = namehash(HANDLE);
  const EMOJI_HASH = namehash(EMOJI_HANDLE);
  const RESOLVER = '0x4444444444444444444444444444444444444444';
  const RESOLVED_ADDRESS = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';

  function mockNameResolution(hash: string, address: string) {
    return jest
      .spyOn(provider, 'batchContractCalls')
      .mockResolvedValueOnce({ [hash]: RESOLVER })
      .mockResolvedValueOnce({ [hash]: address });
  }

  beforeEach(() => {
    RESOLVERS.filter(resolver => resolver !== spaceId).forEach(resolver => {
      jest.spyOn(resolver, 'resolveNames').mockResolvedValue({});
    });
  });

  it('isolates an invalid BNB label from a valid sibling', async () => {
    const batch = mockNameResolution(HASH, RESOLVED_ADDRESS);

    await expect(resolveNames([INVALID_HANDLES[0], HANDLE])).resolves.toEqual({
      [HANDLE]: RESOLVED_ADDRESS
    });
    expect(batch).toHaveBeenCalledTimes(2);
    expect(batch.mock.calls[0][3]).toEqual([HASH]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('returns no results or RPC calls for only invalid BNB labels', async () => {
    const batch = jest.spyOn(provider, 'batchContractCalls').mockResolvedValue({});

    await expect(resolveNames(INVALID_HANDLES)).resolves.toEqual({});
    expect(batch).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('resolves a normalized emoji label', async () => {
    const batch = mockNameResolution(EMOJI_HASH, RESOLVED_ADDRESS);

    await expect(resolveNames([EMOJI_HANDLE])).resolves.toEqual({
      [EMOJI_HANDLE]: RESOLVED_ADDRESS
    });
    expect(batch).toHaveBeenCalledTimes(2);
    expect(batch.mock.calls[0][3]).toEqual([EMOJI_HASH]);
    expect(capture).not.toHaveBeenCalled();
  });

  it('drops a zero address result', async () => {
    const batch = mockNameResolution(HASH, EMPTY_ADDRESS);

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(batch).toHaveBeenCalledTimes(2);
    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps reporting Space ID RPC failures', async () => {
    const error = new Error('rpc unavailable');
    jest.spyOn(provider, 'batchContractCalls').mockRejectedValueOnce(error);

    await expect(resolveNames([HANDLE])).resolves.toEqual({});
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error, {
      tags: { provider: 'Space ID' },
      contexts: { input: { resolveNames: [HANDLE] } }
    });
  });
});
