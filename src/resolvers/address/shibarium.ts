import constants from '../../constants.json';
import { isEvmAddress } from '../../helpers/address';
import { dnsConnect } from '../../helpers/dns';
import { withoutEmptyValues } from '../../helpers/object';
import { Address, Handle, untilAborted, withDeadline } from '../../utils';

export const NAME = 'Shibarium';
const CHAIN_ID = '109';
const NETWORK = 'BONE';
const TLD = 'shib';

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

// TODO: Support unicode names, by converting to punycode
// see https://docs.d3.app/resolve-d3-names#d3-connect-sdk
function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(handle => handle.endsWith(`.${TLD}`));
}

// dns-connect's resolver passes no signal to the DNS-over-HTTPS fetches it makes, so this
// bounds the wait and the requests it started keep running. The budget covers the whole
// fan-out rather than one query: each entry issues several queries in sequence and the
// fan-out is as wide as the batch, so a per-query bound would leave the call unbounded.
function boundedAll<T>(queries: Promise<T>[]): Promise<T[]> {
  return withDeadline(signal => untilAborted(signal, Promise.all(queries)));
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  const client = dnsConnect(constants.d3[CHAIN_ID].forwarder);

  const results = await boundedAll(
    normalizedAddresses.map(address => client.reverseResolve(address, NETWORK))
  );

  return withoutEmptyValues(
    Object.fromEntries(normalizedAddresses.map((address, index) => [address, results[index]]))
  );
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  const client = dnsConnect(constants.d3[CHAIN_ID].forwarder);

  const results = await boundedAll(
    normalizedHandles.map(handle => client.resolve(handle, NETWORK))
  );

  return withoutEmptyValues(
    Object.fromEntries(normalizedHandles.map((handle, index) => [handle, results[index]]))
  );
}
