import {
  Address,
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  Hex,
  multicall3Abi,
  offchainLookupAbiItem,
  parseAbi
} from 'viem';
import { reverseLookup } from '../../../../src/resolvers/address/universalResolver';

const reverseAbi = parseAbi([
  'function reverseWithGateways(bytes reverseName, uint256 coinType, string[] gateways) view returns (string resolvedName, address resolver, address reverseResolver)'
]);
const UNIVERSAL_RESOLVER = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe' as Address;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const ADDRESSES = Array.from(
  { length: 50 },
  (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}` as Address
);
const OFFCHAIN_LOOKUP = encodeErrorResult({
  abi: [offchainLookupAbiItem],
  errorName: 'OffchainLookup',
  args: [UNIVERSAL_RESOLVER, ['https://gateway.test/{data}'], '0x1234', '0x12345678', '0x']
});

type MulticallResult = { success: boolean; returnData: Hex };

function encodeName(name: string): Hex {
  return encodeFunctionResult({
    abi: reverseAbi,
    functionName: 'reverseWithGateways',
    result: [name, ZERO_ADDRESS, ZERO_ADDRESS]
  });
}

function encodeBatch(results: MulticallResult[]): Hex {
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    result: results
  });
}

function decodeBatch(init?: RequestInit) {
  const request = JSON.parse(String(init?.body));
  const decoded = decodeFunctionData({
    abi: multicall3Abi,
    data: request.params[0].data
  });

  if (decoded.functionName !== 'aggregate3') throw new Error('Expected aggregate3');

  return { id: request.id, calls: decoded.args[0] };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function rpcResponse(id: number, results: MulticallResult[]): Response {
  return jsonResponse({ jsonrpc: '2.0', id, result: encodeBatch(results) });
}

function mockRejectedGateway(results: MulticallResult[]) {
  const batchSizes: number[] = [];
  const gatewayError = new Error('gateway unavailable');
  const transport = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).startsWith('https://gateway.test/')) throw gatewayError;

    const { id, calls } = decodeBatch(init);
    batchSizes.push(calls.length);
    return rpcResponse(id, results);
  });

  return { batchSizes, transport };
}

function expectRejectedGateway(errors: unknown[]) {
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
  expect((errors[0] as Error).message).toContain('gateway unavailable');
}

describe('Universal Resolver reverse lookup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the maximum address batch in one eth_call', async () => {
    const batchSizes: number[] = [];
    let nameIndex = 0;
    const transport = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const { id, calls } = decodeBatch(init);
      batchSizes.push(calls.length);
      return rpcResponse(
        id,
        calls.map(() => ({ success: true, returnData: encodeName(`name${nameIndex++}.eth`) }))
      );
    });

    const { values, errors } = await reverseLookup(ADDRESSES);

    expect(errors).toEqual([]);
    expect(Object.keys(values)).toHaveLength(ADDRESSES.length);
    expect(values[ADDRESSES[0]]).toBe('name0.eth');
    expect(values[ADDRESSES[49]]).toBe('name49.eth');
    expect(batchSizes).toEqual([ADDRESSES.length]);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('fetches one offchain entry without splitting the initial batch', async () => {
    const addresses = ADDRESSES.slice(0, 3);
    const batchSizes: number[] = [];
    const gatewayRequests: string[] = [];

    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://gateway.test/')) {
        gatewayRequests.push(url);
        return jsonResponse({ data: '0xabcd' });
      }

      const { id, calls } = decodeBatch(init);
      batchSizes.push(calls.length);
      if (batchSizes.length === 1) {
        return rpcResponse(id, [
          { success: true, returnData: encodeName('name0.eth') },
          { success: false, returnData: OFFCHAIN_LOOKUP },
          { success: true, returnData: encodeName('name2.eth') }
        ]);
      }

      return rpcResponse(id, [{ success: true, returnData: encodeName('name1.eth') }]);
    });

    await expect(reverseLookup(addresses)).resolves.toEqual({
      values: {
        [addresses[0]]: 'name0.eth',
        [addresses[1]]: 'name1.eth',
        [addresses[2]]: 'name2.eth'
      },
      errors: []
    });
    expect(batchSizes).toEqual([addresses.length, 1]);
    expect(gatewayRequests).toHaveLength(1);
  });

  it('returns a rejected offchain gateway request as an error', async () => {
    const address = ADDRESSES[0];
    const { batchSizes, transport } = mockRejectedGateway([
      { success: false, returnData: OFFCHAIN_LOOKUP }
    ]);

    const { values, errors } = await reverseLookup([address]);

    expect(values).toEqual({});
    expectRejectedGateway(errors);
    expect(batchSizes).toEqual([1]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('keeps a successful sibling when an offchain gateway request rejects', async () => {
    const addresses = ADDRESSES.slice(0, 2);
    const { batchSizes, transport } = mockRejectedGateway([
      { success: false, returnData: OFFCHAIN_LOOKUP },
      { success: true, returnData: encodeName('name1.eth') }
    ]);

    const { values, errors } = await reverseLookup(addresses);

    expect(values).toEqual({ [addresses[1]]: 'name1.eth' });
    expectRejectedGateway(errors);
    expect(batchSizes).toEqual([addresses.length]);
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
