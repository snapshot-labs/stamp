import snapshot from '@snapshot-labs/snapshot.js';
import { constants, starknetId, validateAndParseAddress } from 'starknet';
import {
  provider as getProvider,
  isStarkDomain,
  isStarknetAddress,
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

// A 64 hex-digit string is not necessarily a valid Starknet address: anything above
// the felt address bound makes the StarknetID call fail with an opaque
// 'Could not get stark name', which addressResolvers/index would then report as an
// outage. Drop those here, so that error only ever means a real failure.
function isResolvableAddress(address: Address): boolean {
  try {
    validateAndParseAddress(address);
    return true;
  } catch {
    return false;
  }
}

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(a => isStarknetAddress(a) && isResolvableAddress(a));
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(isStarkDomain);
}

// `CallData.compile({ address, hint: [] })`, byte for byte what starknet.js sends: the
// address, then an empty span, which serialises to a bare length of 0.
function addressToDomainCalldata(address: Address): string[] {
  return [address, '0'];
}

// `CallData.compile({ domain: encodedDomain, hint: [] })`: the label count, one felt per
// label leaf first, then the empty hint span.
function domainToAddressCalldata(handle: Handle): string[] {
  const labels = handle
    .replace(/\.stark$/, '')
    .split('.')
    .map(label => starknetId.useEncoded(label).toString(10));

  return [labels.length.toString(), ...labels, '0'];
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

async function callNamingContract(entrypoint: string, calldata: string[][]): Promise<any[]> {
  return await snapshot.utils.multicall(
    NETWORK,
    provider,
    NAMING_ABI,
    calldata.map(args => [NAMING_CONTRACT, entrypoint, args])
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
