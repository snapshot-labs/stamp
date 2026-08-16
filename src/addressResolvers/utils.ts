import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { constants, starknetId } from 'starknet';
import { Address, EMPTY_ADDRESS, Handle } from '../utils';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function isEvmAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// `snapshot.utils.isStarknetAddress` is a felt-range check: `true` for an EVM address too.
export function isStarknetAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address) && snapshot.utils.isStarknetAddress(address);
}

// StarknetID's encoder skips characters outside its alphabet instead of rejecting them, so
// `a!b.stark` encodes exactly like `ab.stark` and would resolve to that owner. Every label has
// to match, subdomains included. The alphabet is starknet.js's `basicAlphabet` plus the two
// `bigAlphabet` glyphs (`这来`), which the encoder does consume, so they round-trip and cannot
// collide -- and `来baba这.stark` is registered on mainnet.
//
// Both bounds on a label are needed. The felt is the real invariant and length is no proxy for
// it: `'a'.repeat(47) + 'b'` resolves where `'a'.repeat(48)` is over-prime, both 48 characters.
// The cap rejects nothing the felt check would have kept -- 49 characters encode to 38^48 at
// the very least, already past the prime -- but it keeps a multi-megabyte label away from
// `useEncoded`, whose BigInt loop grows worse than quadratically before the first await. One
// over-prime label fails the *whole* multicall with a `-32602` that `isSilencedError` does not
// silence, taking down every name batched alongside it.
export function isStarkDomain(domain: Handle): boolean {
  if (!/^[a-z0-9-这来]{1,48}(\.[a-z0-9-这来]{1,48})*\.stark$/.test(domain)) return false;

  return starkDomainLabels(domain).every(label => starknetId.useEncoded(label) < constants.PRIME);
}

// Shared with `domainToAddressCalldata` in addressResolvers/starknet.ts: the labels validated
// here are the labels later sent to the contract, and a second copy of this step could drift.
export function starkDomainLabels(domain: Handle): string[] {
  return domain.replace(/\.stark$/, '').split('.');
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
        return a.toLowerCase();
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
  // An abort is always one of our own deadlines, and each transport words it differently.
  if (error.name === 'AbortError') return true;

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
