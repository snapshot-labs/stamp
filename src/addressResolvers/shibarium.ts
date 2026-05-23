import { capture } from '@snapshot-labs/snapshot-sentry';
import { Address, Handle } from '../utils';
import { FetchError, isEvmAddress, isSilencedError, withoutEmptyValues } from './utils';
import { DNSConnect } from '@webinterop/dns-connect';
import constants from '../constants.json';

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

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  try {
    const dnsConnect = new DNSConnect({
      dns: { forwarderDomain: constants.d3[CHAIN_ID].forwarder }
    });

    const results = await Promise.all(
      normalizedAddresses.map(async address => dnsConnect.reverseResolve(address, NETWORK))
    );

    return withoutEmptyValues(
      Object.fromEntries(normalizedAddresses.map((address, index) => [address, results[index]]))
    );
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { addresses } });
    }
    throw new FetchError();
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  try {
    const normalizedHandles = normalizeHandles(handles);

    if (normalizedHandles.length === 0) return {};

    const dnsConnect = new DNSConnect({
      dns: { forwarderDomain: constants.d3[CHAIN_ID].forwarder }
    });

    const results = await Promise.all(
      normalizedHandles.map(async handle => dnsConnect.resolve(handle, NETWORK))
    );

    return withoutEmptyValues(
      Object.fromEntries(normalizedHandles.map((handle, index) => [handle, results[index]]))
    );
  } catch (e) {
    if (!isSilencedError(e)) {
      capture(e, { input: { handles } });
    }
    throw new FetchError();
  }
}
