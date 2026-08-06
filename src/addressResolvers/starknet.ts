import snapshot from '@snapshot-labs/snapshot.js';
import { CallData, constants, starknetId, validateAndParseAddress } from 'starknet';
import {
  DEFAULT_TIMEOUT,
  provider as getProvider,
  hasStarknetAddressShape,
  isStarkDomain,
  withoutEmptyValues
} from './utils';
import { Address, Handle } from '../utils';

export const NAME = 'Starknet';
const NETWORK = constants.StarknetChainId.SN_MAIN;
const EMPTY_STARKNET_ADDRESS = `0x${'0'.repeat(64)}`;
const NAMING_CONTRACT = starknetId.getStarknetIdContract(NETWORK);
const provider = getProvider(NETWORK);

// The two entrypoints starknet.js calls one address at a time in `getStarkName` and
// `getAddressFromStarkName`. Declared here so `snapshot.utils.multicall` can parse the
// retdata: it keys off `name`, and needs `outputs` to know a domain comes back as a span
// of felts while an address is a single one.
const NAMING_ABI = [
  {
    name: 'address_to_domain',
    type: 'function',
    inputs: [
      { name: 'address', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'hint', type: 'core::array::Span::<core::felt252>' }
    ],
    outputs: [{ type: 'core::array::Span::<core::felt252>' }],
    state_mutability: 'view'
  },
  {
    name: 'domain_to_address',
    type: 'function',
    inputs: [
      { name: 'domain', type: 'core::array::Span::<core::felt252>' },
      { name: 'hint', type: 'core::array::Span::<core::felt252>' }
    ],
    outputs: [{ type: 'core::starknet::contract_address::ContractAddress' }],
    state_mutability: 'view'
  }
];

// Both halves are load-bearing. The shape check is what rejects EVM addresses, which
// `snapshot.utils.isStarknetAddress` reads as perfectly valid felts. And a 64 hex-digit
// string is in turn not necessarily a valid address: anything above the felt address
// bound is rejected by the node, and since the lookup goes through a multicall, one such
// value fails the *whole* batch with '-32602 ... maximum field value was exceeded', which
// `isSilencedError` does not silence, so addressResolvers/index would report an outage
// for every address sent alongside it. Drop them both here.
function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(a => hasStarknetAddressShape(a) && snapshot.utils.isStarknetAddress(a));
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(isStarkDomain);
}

function addressToDomainCalldata(address: Address): string[] {
  return CallData.compile({ address, hint: [] });
}

function domainToAddressCalldata(handle: Handle): string[] {
  const domain = handle
    .replace(/\.stark$/, '')
    .split('.')
    .map(label => starknetId.useEncoded(label));

  return CallData.compile({ domain, hint: [] });
}

// An address with no domain answers with an empty span rather than an error, so a miss
// is a value here instead of a throw. Anything that does throw out of `multicall` is an
// RPC or network fault and is left to propagate to `index.ts`, which captures it.
function decodeDomain(span: unknown): Handle | undefined {
  if (!Array.isArray(span) || span.length === 0) return undefined;

  return starknetId.useDecoded(span.map(felt => BigInt(felt))) || undefined;
}

function decodeAddress(rawAddress: unknown): Address | undefined {
  if (typeof rawAddress !== 'string') return undefined;

  const address = validateAndParseAddress(rawAddress);

  return address === EMPTY_STARKNET_ADDRESS ? undefined : address;
}

// `provider()` passes `timeout` like every other resolver, but snapshot.js's
// `getStarknetProvider` forwards only `nodeUrl` -- unlike `getEvmProvider`, which does
// forward it -- and starknet.js v6's `RpcChannel` carries no `AbortSignal`, so nothing
// downstream bounds the call. A brovider that accepts the connection but never answers
// would otherwise hang until undici's ~300s ceiling, and since `index.ts` awaits every
// resolver under one `Promise.all`, that stalls the whole request, non-Starknet inputs
// included. The axios path this replaced had a real 5s bound, so keep one here until
// `getStarknetProvider` honours the option. `ETIMEDOUT` is the code `isSilencedError`
// already treats as a transient fault for the axios and ethers resolvers.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error(`Starknet RPC call timed out after ${ms}ms`), {
            code: 'ETIMEDOUT'
          })
        ),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function callNamingContract(entrypoint: string, calldata: string[][]): Promise<any[]> {
  return await withTimeout(
    snapshot.utils.multicall(
      NETWORK,
      provider,
      NAMING_ABI,
      calldata.map(args => [NAMING_CONTRACT, entrypoint, args])
    ),
    DEFAULT_TIMEOUT
  );
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const results = await callNamingContract(
    'address_to_domain',
    normalizedAddresses.map(addressToDomainCalldata)
  );

  return withoutEmptyValues(
    Object.fromEntries(
      normalizedAddresses.map((address, i) => [address, decodeDomain(results[i]?.[0])])
    )
  );
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const results = await callNamingContract(
    'domain_to_address',
    normalizedHandles.map(domainToAddressCalldata)
  );

  return withoutEmptyValues(
    Object.fromEntries(
      normalizedHandles.map((handle, i) => [handle, decodeAddress(results[i]?.[0])])
    )
  );
}
