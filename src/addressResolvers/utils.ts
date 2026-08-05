import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { Address, EMPTY_ADDRESS, Handle } from '../utils';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function isEvmAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isStarknetAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

// A Starknet address is a field element, so it is strictly below
// L2_ADDRESS_UPPER_BOUND. Any other 64-char hex blob (a transaction hash, a
// proposal id) also matches isStarknetAddress, and about 97% of those are out
// of range. Kept private and applied in normalizeAddresses only: isStarknetAddress
// is used elsewhere as a "skip getAddress()" guard, which must keep matching on
// shape alone.
const L2_ADDRESS_UPPER_BOUND = 2n ** 251n - 256n;

function isStarknetAddressInRange(address: Address): boolean {
  return BigInt(address) < L2_ADDRESS_UPPER_BOUND;
}

export function provider(
  network: string,
  providerOptions: { broviderUrl?: string; timeout?: number } = { broviderUrl, timeout: 5e3 }
) {
  return snapshot.utils.getProvider(network, providerOptions);
}

export function withoutEmptyValues(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value));
}

export function withoutEmptyAddress(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => key !== EMPTY_ADDRESS));
}

export function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses
    .map(a => {
      if (isStarknetAddress(a)) {
        // The hub rejects the whole id_in batch when a single out-of-range value
        // reaches it, nulling the names of up to MAX_LOOKUP_ADDRESSES addresses.
        return isStarknetAddressInRange(a) ? a.toLowerCase() : undefined;
      }
      try {
        return getAddress(a.toLowerCase());
      } catch {}
    })
    .filter(a => a) as Address[];
}

export function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => /^[^\s]*\.[^\s]*$/.test(h)).map(h => h.toLowerCase());
}

export function isSilencedError(error: any, additionalMessages?: string[]): boolean {
  const messages = [
    'invalid token ID',
    'is not supported',
    'execution reverted',
    'status=504',
    // SERVFAIL (2) is a transient external-resolver failure. Other statuses stay
    // visible as they may signal a real problem (e.g. FORMERR 1 = malformed query);
    // NXDOMAIN (3) never reaches here (dns-connect returns it as an empty result).
    'Received error status from DNS server: 2.',
    ...(additionalMessages || [])
  ];
  const codes = [
    error.error?.code,
    error.error?.status,
    error.code,
    error.status,
    error.response?.status,
    error.cause?.code
  ];
  return (
    messages.some(
      m =>
        error.message?.includes(m) ||
        error.error?.message?.includes(m) ||
        error.cause?.message?.includes(m)
    ) ||
    ['TIMEOUT', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 504, 429].some(c =>
      codes.some(v => String(v ?? '').includes(String(c)))
    )
  );
}

export function mapOriginalInput(
  input: string[],
  results: Record<string, string>
): Record<string, string> {
  const inputLc = input.map(i => i?.toLowerCase());
  const resultLc = Object.fromEntries(
    Object.entries(results).map(([key, value]) => [key.toLowerCase(), value])
  );

  return withoutEmptyValues(
    Object.fromEntries(
      inputLc.map((key, index) => {
        return [input[index], resultLc[key]];
      })
    )
  );
}
