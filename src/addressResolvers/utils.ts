import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { Address, EMPTY_ADDRESS, Handle } from '../utils';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export class FetchError extends Error {}

export function isEvmAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isStarknetAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
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

// NORMALIZATION, not validation. getAddress() checksums EVM addresses and
// Starknet addresses are lowercased so the redis cache keys and the dedup Set
// in src/addressResolvers/index.ts are stable regardless of input casing. This
// step MUST stay even though the branded Address type already guarantees shape
// at the JSON-RPC boundary.
//
// It also still drops anything getAddress() rejects: the clearCache path
// (src/api.ts /clear/address/:id) reaches here with a raw, unbranded route
// param, so this thin reject is the boundary guard for that one path. The
// other callers pass branded Address[] for which the filter is a no-op.
export function normalizeAddresses(addresses: string[]): Address[] {
  return addresses
    .map(a => {
      if (isStarknetAddress(a)) {
        return a.toLowerCase();
      }
      try {
        return getAddress(a.toLowerCase());
      } catch {}
    })
    .filter(a => a) as Address[];
}

export function normalizeHandles(handles: string[]): Handle[] {
  return handles.filter(h => /^[^\s]*\.[^\s]*$/.test(h)).map(h => h.toLowerCase()) as Handle[];
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
  const codes = [error.error?.code, error.error?.status, error.code, error.response?.status];
  return (
    messages.some(m => error.message?.includes(m) || error.error?.message?.includes(m)) ||
    ['TIMEOUT', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 504].some(c =>
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
