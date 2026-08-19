import {
  Address,
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionData,
  encodeFunctionResult,
  Hex,
  multicall3Abi,
  offchainLookupAbiItem,
  parseAbi
} from 'viem';
import * as deadline from '../../../../src/helpers/deadline';
import { MAX_LOOKUP_ADDRESSES } from '../../../../src/resolvers/address';
import {
  BatchError,
  isSilencedReverseError,
  reverseLookup
} from '../../../../src/resolvers/address/universalResolver';

const reverseAbi = parseAbi([
  'function reverseWithGateways(bytes reverseName, uint256 coinType, string[] gateways) view returns (string resolvedName, address resolver, address reverseResolver)'
]);
const httpErrorAbi = parseAbi(['error HttpError(uint16 status, string message)']);
const resolverErrorAbi = parseAbi(['error ResolverError(bytes errorData)']);
const solidityErrorAbi = parseAbi(['error Error(string message)']);
const batchGatewayAbi = parseAbi([
  'function query((address sender, string[] urls, bytes data)[] queries) view returns (bool[] failures, bytes[] responses)'
]);
const UNIVERSAL_RESOLVER = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe' as Address;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const ADDRESSES = Array.from(
  { length: MAX_LOOKUP_ADDRESSES },
  (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}` as Address
);
const OFFCHAIN_LOOKUP = encodeErrorResult({
  abi: [offchainLookupAbiItem],
  errorName: 'OffchainLookup',
  args: [UNIVERSAL_RESOLVER, ['https://gateway.test/{data}'], '0x1234', '0x12345678', '0x']
});
const BATCH_QUERY = encodeFunctionData({
  abi: batchGatewayAbi,
  functionName: 'query',
  args: [
    [
      {
        sender: UNIVERSAL_RESOLVER,
        urls: ['https://gateway.test/{data}'],
        data: '0x1234'
      }
    ]
  ]
});
const BATCH_OFFCHAIN_LOOKUP = encodeErrorResult({
  abi: [offchainLookupAbiItem],
  errorName: 'OffchainLookup',
  args: [UNIVERSAL_RESOLVER, ['x-batch-gateway:true'], BATCH_QUERY, '0x12345678', '0x']
});
const ABORTED_ERROR = encodeErrorResult({
  abi: solidityErrorAbi,
  errorName: 'Error',
  args: ['This operation was aborted']
});

const HTTP_ERROR = encodeErrorResult({
  abi: httpErrorAbi,
  errorName: 'HttpError',
  args: [503, 'gateway unavailable']
});
const BATCH_HTTP_ERROR = encodeErrorResult({
  abi: httpErrorAbi,
  errorName: 'HttpError',
  args: [503, 'HTTP request failed.']
});

const RESOLVER_ERROR = encodeErrorResult({
  abi: resolverErrorAbi,
  errorName: 'ResolverError',
  args: ['0x80b90f']
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

function expectRejectedGateway(errors: BatchError[], address: Address) {
  expect(errors).toHaveLength(1);
  expect(errors[0].address).toBe(address);
  expect(errors[0].error).toBeInstanceOf(Error);
  expect((errors[0].error as Error).message).toContain('gateway unavailable');
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
    expect(values[ADDRESSES[MAX_LOOKUP_ADDRESSES - 1]]).toBe(`name${MAX_LOOKUP_ADDRESSES - 1}.eth`);
    expect(batchSizes).toEqual([ADDRESSES.length]);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('caps batches shared by concurrent maximum-size lookups', async () => {
    const batchSizes: number[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const { id, calls } = decodeBatch(init);
      batchSizes.push(calls.length);
      return rpcResponse(
        id,
        calls.map(() => ({ success: true, returnData: encodeName('name.eth') }))
      );
    });

    const results = await Promise.all([reverseLookup(ADDRESSES), reverseLookup(ADDRESSES)]);

    expect(results.every(result => result.errors.length === 0)).toBe(true);
    expect(results.map(result => Object.keys(result.values).length)).toEqual([
      MAX_LOOKUP_ADDRESSES,
      MAX_LOOKUP_ADDRESSES
    ]);
    expect(batchSizes).toHaveLength(2);
    expect(batchSizes.reduce((sum, size) => sum + size, 0)).toBe(2 * MAX_LOOKUP_ADDRESSES);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(56);
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

  it('treats a ResolverError as an empty reverse lookup', async () => {
    const address = ADDRESSES[0];
    const transport = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const { id } = decodeBatch(init);
      return rpcResponse(id, [{ success: false, returnData: RESOLVER_ERROR }]);
    });

    await expect(reverseLookup([address])).resolves.toEqual({ values: {}, errors: [] });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('returns a Universal Resolver HTTP failure as an error', async () => {
    const address = ADDRESSES[0];
    const transport = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const { id } = decodeBatch(init);
      return rpcResponse(id, [{ success: false, returnData: HTTP_ERROR }]);
    });

    const { values, errors } = await reverseLookup([address]);

    expect(values).toEqual({});
    expect(errors[0].address).toBe(address);
    expect(errors[0].error).toBeInstanceOf(Error);
    expect((errors[0].error as Error).message).toContain('gateway unavailable');
    expect(isSilencedReverseError(errors[0].error)).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('silences a transient HTTP failure from the local batch gateway', async () => {
    const address = ADDRESSES[0];
    let callbackData = '';
    let rpcCalls = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('https://gateway.test/')) {
        return new Response('unavailable', { status: 503 });
      }

      const { id, calls } = decodeBatch(init);
      rpcCalls += 1;
      if (rpcCalls === 1) {
        return rpcResponse(id, [{ success: false, returnData: BATCH_OFFCHAIN_LOOKUP }]);
      }

      callbackData = calls[0].callData;
      return rpcResponse(id, [{ success: false, returnData: BATCH_HTTP_ERROR }]);
    });

    const { values, errors } = await reverseLookup([address]);

    expect(values).toEqual({});
    expect(errors[0].address).toBe(address);
    expect(isSilencedReverseError(errors[0].error)).toBe(true);
    expect(callbackData).toContain(BATCH_HTTP_ERROR.slice(2));
    expect(rpcCalls).toBe(2);
  });

  it('returns a rejected offchain gateway request as an error', async () => {
    const address = ADDRESSES[0];
    const { batchSizes, transport } = mockRejectedGateway([
      { success: false, returnData: OFFCHAIN_LOOKUP }
    ]);

    const { values, errors } = await reverseLookup([address]);

    expect(values).toEqual({});
    expectRejectedGateway(errors, address);
    expect(batchSizes).toEqual([1]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('bounds a stalled gateway while retaining a successful sibling', async () => {
    const addresses = ADDRESSES.slice(0, 2);
    const batchSizes: number[] = [];
    let callbackData = '';
    const actualWithDeadline = deadline.withDeadline;
    jest.spyOn(deadline, 'withDeadline').mockImplementation(fn => actualWithDeadline(fn, 5));
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('https://gateway.test/')) {
        if (!init?.signal) throw new Error('Missing gateway deadline signal');

        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        });
      }

      const { id, calls } = decodeBatch(init);
      batchSizes.push(calls.length);
      if (batchSizes.length === 1) {
        return rpcResponse(id, [
          { success: false, returnData: BATCH_OFFCHAIN_LOOKUP },
          { success: true, returnData: encodeName('name1.eth') }
        ]);
      }

      callbackData = calls[0].callData;
      return rpcResponse(id, [{ success: false, returnData: ABORTED_ERROR }]);
    });

    const { values, errors } = await reverseLookup(addresses);
    const reverted = (errors[0].error as any).walk(
      cause => cause instanceof Error && cause.name === 'ContractFunctionRevertedError'
    );

    expect(values).toEqual({ [addresses[1]]: 'name1.eth' });
    expect(errors[0].address).toBe(addresses[0]);
    expect(reverted.data).toMatchObject({
      errorName: 'Error',
      args: ['This operation was aborted']
    });
    expect(isSilencedReverseError(errors[0].error)).toBe(true);
    expect(callbackData).toContain(ABORTED_ERROR.slice(2));
    expect(batchSizes).toEqual([addresses.length, 1]);
  });

  it('keeps a successful sibling when an offchain gateway request rejects', async () => {
    const addresses = ADDRESSES.slice(0, 2);
    const { batchSizes, transport } = mockRejectedGateway([
      { success: false, returnData: OFFCHAIN_LOOKUP },
      { success: true, returnData: encodeName('name1.eth') }
    ]);

    const { values, errors } = await reverseLookup(addresses);

    expect(values).toEqual({ [addresses[1]]: 'name1.eth' });
    expectRejectedGateway(errors, addresses[0]);
    expect(batchSizes).toEqual([addresses.length]);
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
