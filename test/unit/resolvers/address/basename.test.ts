import { Interface } from '@ethersproject/abi';
import { namehash } from '@ethersproject/hash';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { lookupAddresses, resolveNames } from '../../../../src/resolvers/address/basename';

const ADDRESS_WITH_NAME = '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9';
const SECOND_ADDRESS_WITH_NAME = '0x5b76f5B8fc9D700624F78208132f91AD4e61a1f0';
const ADDRESS_WITHOUT_NAME = '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1';
const HANDLE = 'jesse.base.eth';
const SECOND_HANDLE = 'barmstrong.base.eth';
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const COIN_TYPE = '80002105';
const RESOLVER_ABI = [
  'function name(bytes32 node) view returns (string)',
  'function addr(bytes32 node) view returns (address)'
];
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)'
];

const resolverInterface = new Interface(RESOLVER_ABI);
const multicallInterface = new Interface(MULTICALL_ABI);
const reverseNode = (address: string) =>
  namehash(`${address.toLowerCase().slice(2)}.${COIN_TYPE}.reverse`);

function resolverResponse(data: string): string {
  const transaction = resolverInterface.parseTransaction({ data });

  if (transaction.name === 'name') {
    const name =
      transaction.args.node === reverseNode(ADDRESS_WITH_NAME)
        ? HANDLE
        : transaction.args.node === reverseNode(SECOND_ADDRESS_WITH_NAME)
          ? SECOND_HANDLE
          : '';
    return resolverInterface.encodeFunctionResult('name', [name]);
  }

  const address =
    transaction.args.node === namehash(HANDLE)
      ? ADDRESS_WITH_NAME
      : transaction.args.node === namehash(SECOND_HANDLE)
        ? SECOND_ADDRESS_WITH_NAME
        : EMPTY_ADDRESS;
  return resolverInterface.encodeFunctionResult('addr', [address]);
}

function rpcResponse(data: string): string {
  try {
    const calls = multicallInterface.decodeFunctionData('aggregate', data).calls;
    return multicallInterface.encodeFunctionResult('aggregate', [
      1,
      calls.map(call => resolverResponse(call.callData))
    ]);
  } catch {
    return resolverResponse(data);
  }
}

describe('resolvers/address/basename batching', () => {
  let send: jest.SpyInstance;

  beforeEach(() => {
    send = jest
      .spyOn(StaticJsonRpcProvider.prototype, 'send')
      .mockImplementation(async (method, params) => {
        if (method !== 'eth_call') throw new Error(`Unexpected RPC method: ${method}`);
        return rpcResponse(params[0].data);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('looks up multiple addresses in one RPC call', async () => {
    await expect(
      lookupAddresses([ADDRESS_WITH_NAME, SECOND_ADDRESS_WITH_NAME, ADDRESS_WITHOUT_NAME])
    ).resolves.toEqual({
      [ADDRESS_WITH_NAME]: HANDLE,
      [SECOND_ADDRESS_WITH_NAME]: SECOND_HANDLE
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resolves multiple names in one RPC call', async () => {
    await expect(resolveNames([HANDLE, SECOND_HANDLE, 'unknown.base.eth'])).resolves.toEqual({
      [HANDLE]: ADDRESS_WITH_NAME,
      [SECOND_HANDLE]: SECOND_ADDRESS_WITH_NAME
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
