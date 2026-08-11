import snapshot from '@snapshot-labs/snapshot.js';
import { CallData, constants, starknetId, validateAndParseAddress } from 'starknet';
import {
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

// The shape check alone is not enough: a 64 hex-digit string can still be over the felt
// address bound, and one such value fails the *whole* multicall batch, not just itself.
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
