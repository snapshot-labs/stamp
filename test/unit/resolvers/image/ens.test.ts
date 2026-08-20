import snapshot from '@snapshot-labs/snapshot.js';
import { fetchHttpImage } from '../../../../src/helpers/http';
import { lookupAddresses } from '../../../../src/resolvers/address';
import resolve from '../../../../src/resolvers/image/ens';

jest.mock('../../../../src/helpers/http', () => ({ fetchHttpImage: jest.fn() }));
jest.mock('../../../../src/resolvers/address', () => ({ lookupAddresses: jest.fn() }));

const EVM_ADDRESS = '0x0000000000000000000000000000000000000001';
const STARKNET_ADDRESS = '0x0779ba6e4e227947acbbdfb978a292c401339027eeb3d768f5d12cd2e818265a';
const INVALID_NAMES = [STARKNET_ADDRESS, 'nodot', 'a..b', '../avatar/vitalik.eth'];
const VALID_NAMES = [
  ['vitalik.eth', 'vitalik.eth'],
  ['foo.xyz', 'foo.xyz'],
  ['ⓥⓘⓣⓐⓛⓘⓚ.eth', 'vitalik.eth']
] as const;

const mockTransportRequest = jest.fn();

jest.mock('viem', () => {
  const viem = jest.requireActual('viem');
  return {
    ...viem,
    http: jest.fn(() => viem.custom({ request: mockTransportRequest }))
  };
});

const mockedFetchHttpImage = jest.mocked(fetchHttpImage);
const mockedLookupAddresses = jest.mocked(lookupAddresses);
const originalBroviderUrl = process.env.BROVIDER_URL;

beforeEach(() => {
  process.env.BROVIDER_URL = 'https://custom.rpc';
  mockTransportRequest.mockReset();
  mockedFetchHttpImage.mockReset();
  mockedLookupAddresses.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalBroviderUrl === undefined) delete process.env.BROVIDER_URL;
  else process.env.BROVIDER_URL = originalBroviderUrl;
});

describe('resolvers/image/ens', () => {
  it.each(INVALID_NAMES)('skips the provider for %s', async input => {
    const getEnsTextRecord = jest.spyOn(snapshot.utils, 'getEnsTextRecord');

    await expect(resolve(input)).resolves.toBe(false);
    expect(getEnsTextRecord).not.toHaveBeenCalled();
    expect(mockTransportRequest).not.toHaveBeenCalled();
    expect(mockedFetchHttpImage).not.toHaveBeenCalled();
  });

  it.each(VALID_NAMES)('asks the provider for %s', async (input, normalized) => {
    const getEnsTextRecord = jest.spyOn(snapshot.utils, 'getEnsTextRecord').mockResolvedValue(null);
    const image = Buffer.from('avatar');
    mockedFetchHttpImage.mockResolvedValue(image);

    await expect(resolve(input)).resolves.toBe(image);
    expect(getEnsTextRecord).toHaveBeenCalledWith(normalized, 'avatar', '1', {
      broviderUrl: 'https://custom.rpc',
      timeout: 5e3
    });
  });

  it.each(['Kamruzzaman', 'a..b'])('rejects an invalid reverse result %s', async reverseName => {
    mockedLookupAddresses.mockResolvedValue({ [EVM_ADDRESS]: reverseName });
    const getEnsTextRecord = jest.spyOn(snapshot.utils, 'getEnsTextRecord').mockResolvedValue(null);

    await expect(resolve(EVM_ADDRESS)).resolves.toBe(false);

    expect(mockedLookupAddresses).toHaveBeenCalledWith([EVM_ADDRESS]);
    expect(getEnsTextRecord).not.toHaveBeenCalled();
    expect(mockTransportRequest).not.toHaveBeenCalled();
    expect(mockedFetchHttpImage).not.toHaveBeenCalled();
  });

  it('normalizes a valid reverse result before lookup and fallback', async () => {
    mockedLookupAddresses.mockResolvedValue({ [EVM_ADDRESS]: 'VITALIK.eth' });
    const getEnsTextRecord = jest.spyOn(snapshot.utils, 'getEnsTextRecord').mockResolvedValue(null);
    const image = Buffer.from('avatar');
    mockedFetchHttpImage.mockResolvedValue(image);

    await expect(resolve(EVM_ADDRESS)).resolves.toBe(image);

    expect(getEnsTextRecord).toHaveBeenCalledWith('vitalik.eth', 'avatar', '1', {
      broviderUrl: 'https://custom.rpc',
      timeout: 5e3
    });
    expect(mockedFetchHttpImage).toHaveBeenCalledWith(
      'https://metadata.ens.domains/mainnet/avatar/vitalik.eth'
    );
  });

  it('uses a direct HTTP avatar record', async () => {
    const url = 'https://example.com/avatar.png';
    const image = Buffer.from('avatar');
    jest.spyOn(snapshot.utils, 'getEnsTextRecord').mockResolvedValue(url);
    mockedFetchHttpImage.mockResolvedValue(image);

    await expect(resolve('vitalik.eth')).resolves.toBe(image);

    expect(mockedFetchHttpImage).toHaveBeenCalledWith(url);
  });

  it('keeps a normalized name in one fallback path segment', async () => {
    const image = Buffer.from('avatar');
    jest.spyOn(snapshot.utils, 'getEnsTextRecord').mockResolvedValue(null);
    mockedFetchHttpImage.mockResolvedValue(image);

    await expect(resolve('🌈.eth')).resolves.toBe(image);

    expect(mockedFetchHttpImage).toHaveBeenCalledWith(
      'https://metadata.ens.domains/mainnet/avatar/%F0%9F%8C%88.eth'
    );
  });

  it('preserves provider failures for the outer failure contract', async () => {
    const error = new Error('provider unavailable');
    jest.spyOn(snapshot.utils, 'getEnsTextRecord').mockRejectedValue(error);

    await expect(resolve('vitalik.eth')).rejects.toBe(error);
  });

  it('uses one request for an onchain text lookup and keeps the metadata fallback', async () => {
    const getEnsTextRecord = jest.spyOn(snapshot.utils, 'getEnsTextRecord');
    const { encodeAbiParameters } = jest.requireActual('viem');
    const textResult = encodeAbiParameters([{ type: 'string' }], ['']);
    const resolverResult = encodeAbiParameters(
      [{ type: 'bytes' }, { type: 'address' }],
      [textResult, '0x0000000000000000000000000000000000000001']
    );
    mockTransportRequest.mockResolvedValue(resolverResult);
    const image = Buffer.from('avatar');
    mockedFetchHttpImage.mockResolvedValueOnce(image);

    await expect(resolve('example.eth')).resolves.toBe(image);

    expect(getEnsTextRecord).toHaveBeenCalledWith('example.eth', 'avatar', '1', {
      broviderUrl: 'https://custom.rpc',
      timeout: 5e3
    });
    expect(mockTransportRequest).toHaveBeenCalledTimes(1);
    expect(mockTransportRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_call' }),
      undefined
    );
    expect(mockedFetchHttpImage).toHaveBeenCalledWith(
      'https://metadata.ens.domains/mainnet/avatar/example.eth'
    );
  });
});
