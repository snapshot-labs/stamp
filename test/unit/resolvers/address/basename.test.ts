import { Interface } from '@ethersproject/abi';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { namehash } from 'viem/ens';
import {
  getAvatar,
  lookupAddresses,
  resolveNames
} from '../../../../src/resolvers/address/basename';

const ADDRESS_WITH_NAME = '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9';
const SECOND_ADDRESS_WITH_NAME = '0x5b76f5B8fc9D700624F78208132f91AD4e61a1f0';
const EMOJI_ADDRESS_WITH_NAME = '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6';
const ADDRESS_WITHOUT_NAME = '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1';
const UPGRADED_ADDRESS_WITH_NAME = '0xEAe6aa1802e2938F510ecDc6Ae18f538be6ED9e1';
const CUSTOM_RESOLVER_ADDRESS = '0x00000000000000000000000000000000000000CC';
const HANDLE = 'jesse.base.eth';
const SECOND_HANDLE = 'barmstrong.base.eth';
const EMOJI_HANDLE = '🫨.base.eth';
const UPGRADED_HANDLE = 'boorger.stage.base.eth';
const CUSTOM_RESOLVER_HANDLE = 'custom.base.eth';
const AVATAR = 'https://example.com/avatar.png';
const UPGRADED_AVATAR = 'https://example.com/upgraded.png';
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const REGISTRY = '0xB94704422c2a1E396835A571837Aa5AE53285a95';
const LEGACY_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';
const UPGRADED_RESOLVER = '0x426fA03fB86E510d0Dd9F70335Cf102a98b10875';
const CUSTOM_RESOLVER = '0x00000000000000000000000000000000000000EE';
const COIN_TYPE = '80002105';
const RESOLVER_ABI = [
  'function name(bytes32 node) view returns (string)',
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)',
  'function resolver(bytes32 node) view returns (address)'
];
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)'
];

const resolverInterface = new Interface(RESOLVER_ABI);
const multicallInterface = new Interface(MULTICALL_ABI);
const reverseNode = (address: string) =>
  namehash(`${address.toLowerCase().slice(2)}.${COIN_TYPE}.reverse`);
const ADDRESS_BY_NODE: Record<string, string> = {
  [namehash(HANDLE)]: ADDRESS_WITH_NAME,
  [namehash(SECOND_HANDLE)]: SECOND_ADDRESS_WITH_NAME,
  [namehash(EMOJI_HANDLE)]: EMOJI_ADDRESS_WITH_NAME,
  [namehash(UPGRADED_HANDLE)]: UPGRADED_ADDRESS_WITH_NAME
};
// Names and reverse records living on the upgraded resolver; everything else
// stays on the legacy resolver, and the registry knows nothing about unknown
// nodes.
const UPGRADED_NODES = new Set<string>([
  namehash(UPGRADED_HANDLE),
  reverseNode(UPGRADED_ADDRESS_WITH_NAME)
]);
// A name whose owner pointed it at their own resolver contract, which reverts.
const CUSTOM_NODES = new Set<string>([
  namehash(CUSTOM_RESOLVER_HANDLE),
  reverseNode(CUSTOM_RESOLVER_ADDRESS)
]);
const LEGACY_NODES = new Set<string>([
  ...Object.keys(ADDRESS_BY_NODE).filter(node => !UPGRADED_NODES.has(node)),
  reverseNode(ADDRESS_WITH_NAME),
  reverseNode(SECOND_ADDRESS_WITH_NAME)
]);

function registryResponse(node: string): string {
  const resolver = UPGRADED_NODES.has(node)
    ? UPGRADED_RESOLVER
    : CUSTOM_NODES.has(node)
      ? CUSTOM_RESOLVER
      : LEGACY_NODES.has(node)
        ? LEGACY_RESOLVER
        : EMPTY_ADDRESS;
  return resolverInterface.encodeFunctionResult('resolver', [resolver]);
}

function nameFor(node: string): string {
  if (node === reverseNode(ADDRESS_WITH_NAME)) return HANDLE;
  if (node === reverseNode(SECOND_ADDRESS_WITH_NAME)) return SECOND_HANDLE;
  if (node === reverseNode(UPGRADED_ADDRESS_WITH_NAME)) return UPGRADED_HANDLE;
  return '';
}

function resolverResponse(data: string, target: string): string {
  const transaction = resolverInterface.parseTransaction({ data });

  if (transaction.name === 'resolver') {
    if (target.toLowerCase() !== REGISTRY.toLowerCase())
      throw new Error('resolver() asked outside the registry');
    return registryResponse(transaction.args.node);
  }

  if (target.toLowerCase() === CUSTOM_RESOLVER.toLowerCase())
    throw new Error('custom resolver reverted');

  // Records only exist on the resolver the registry points at.
  const node: string = transaction.args.node;
  const expected = UPGRADED_NODES.has(node) ? UPGRADED_RESOLVER : LEGACY_RESOLVER;
  const onRightResolver = target.toLowerCase() === expected.toLowerCase();

  if (transaction.name === 'name') {
    return resolverInterface.encodeFunctionResult('name', [onRightResolver ? nameFor(node) : '']);
  }

  if (transaction.name === 'text') {
    const text = !onRightResolver
      ? ''
      : node === namehash(EMOJI_HANDLE)
        ? AVATAR
        : node === namehash(UPGRADED_HANDLE)
          ? UPGRADED_AVATAR
          : '';
    return resolverInterface.encodeFunctionResult('text', [text]);
  }

  const address = onRightResolver ? (ADDRESS_BY_NODE[node] ?? EMPTY_ADDRESS) : EMPTY_ADDRESS;
  return resolverInterface.encodeFunctionResult('addr', [address]);
}

function rpcResponse(data: string, to: string): string {
  try {
    const calls = multicallInterface.decodeFunctionData('aggregate', data).calls;
    return multicallInterface.encodeFunctionResult('aggregate', [
      1,
      calls.map(call => resolverResponse(call.callData, call.target))
    ]);
  } catch {
    return resolverResponse(data, to);
  }
}

describe('resolvers/address/basename batching', () => {
  let send: jest.SpyInstance;

  beforeEach(() => {
    send = jest
      .spyOn(StaticJsonRpcProvider.prototype, 'send')
      .mockImplementation(async (method, params) => {
        if (method !== 'eth_call') throw new Error(`Unexpected RPC method: ${method}`);
        return rpcResponse(params[0].data, params[0].to);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('looks up multiple addresses with one registry call and one records call', async () => {
    await expect(
      lookupAddresses([
        ADDRESS_WITH_NAME,
        SECOND_ADDRESS_WITH_NAME,
        UPGRADED_ADDRESS_WITH_NAME,
        ADDRESS_WITHOUT_NAME
      ])
    ).resolves.toEqual({
      [ADDRESS_WITH_NAME]: HANDLE,
      [SECOND_ADDRESS_WITH_NAME]: SECOND_HANDLE,
      [UPGRADED_ADDRESS_WITH_NAME]: UPGRADED_HANDLE
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('resolves multiple names across resolvers with one registry call and one records call', async () => {
    await expect(
      resolveNames([HANDLE, SECOND_HANDLE, UPGRADED_HANDLE, 'unknown.base.eth'])
    ).resolves.toEqual({
      [HANDLE]: ADDRESS_WITH_NAME,
      [SECOND_HANDLE]: SECOND_ADDRESS_WITH_NAME,
      [UPGRADED_HANDLE]: UPGRADED_ADDRESS_WITH_NAME
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('resolves a name using codepoints newer than the hasher', async () => {
    await expect(resolveNames([EMOJI_HANDLE, HANDLE])).resolves.toEqual({
      [EMOJI_HANDLE]: EMOJI_ADDRESS_WITH_NAME,
      [HANDLE]: ADDRESS_WITH_NAME
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reads the avatar of a name using codepoints newer than the hasher', async () => {
    await expect(getAvatar(EMOJI_HANDLE)).resolves.toEqual(AVATAR);
  });

  it('reads the avatar from the resolver the registry points at', async () => {
    await expect(getAvatar(UPGRADED_HANDLE)).resolves.toEqual(UPGRADED_AVATAR);
    await expect(getAvatar(UPGRADED_ADDRESS_WITH_NAME)).resolves.toEqual(UPGRADED_AVATAR);
  });

  it('skips nodes on resolvers Base does not operate so one bad name cannot fail the batch', async () => {
    await expect(lookupAddresses([ADDRESS_WITH_NAME, CUSTOM_RESOLVER_ADDRESS])).resolves.toEqual({
      [ADDRESS_WITH_NAME]: HANDLE
    });
    await expect(resolveNames([CUSTOM_RESOLVER_HANDLE, UPGRADED_HANDLE])).resolves.toEqual({
      [UPGRADED_HANDLE]: UPGRADED_ADDRESS_WITH_NAME
    });
    await expect(getAvatar(CUSTOM_RESOLVER_HANDLE)).resolves.toBeNull();
  });
});
