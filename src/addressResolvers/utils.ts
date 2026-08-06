import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { constants, starknetId } from 'starknet';
import { Address, EMPTY_ADDRESS, Handle } from '../utils';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function isEvmAddress(address: Address): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// A shape check only, and deliberately not named after `snapshot.utils.isStarknetAddress`:
// that one asks whether the value is a felt below the address bound, and answers `true`
// for an EVM address. This one is what tells the two address formats apart.
export function hasStarknetAddressShape(address: Address): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

// StarknetID's encoder skips any character outside its alphabet instead of rejecting it,
// so `a!b.stark` encodes exactly like `ab.stark` and resolves to that owner, and
// `!!!.stark` encodes to felt 0, which maps to a real account. Checking the suffix is
// therefore not enough: every label has to match the alphabet, subdomains included.
//
// That alphabet is starknet.js's `basicAlphabet` (`[a-z0-9-]`) *plus* the two-glyph
// `bigAlphabet` (`这来`). Those two are safe to admit: unlike a skipped character, the
// encoder consumes them and advances the multiplier, so they round-trip through
// `useDecoded` and cannot collide with a shorter handle. They are also in live use --
// `来baba这.stark` is registered on mainnet.
//
// The character class alone is not sufficient either. A label whose felt reaches the
// field prime is rejected by the node, and because resolution is a single atomic
// multicall, that one value fails the *whole* batch with `-32602 ... maximum field value
// was exceeded` -- which `isSilencedError` does not silence, so it would report an outage
// for every name sent alongside it. Length is the wrong proxy for that bound:
// `'a'.repeat(47) + 'b'` is 48 characters and resolves, `'a'.repeat(48)` is 48 characters
// and is over-prime. Guard on the felt itself.
export function isStarkDomain(domain: Handle): boolean {
  if (!/^[a-z0-9-这来]+(\.[a-z0-9-这来]+)*\.stark$/.test(domain)) return false;

  return domain
    .replace(/\.stark$/, '')
    .split('.')
    .every(label => starknetId.useEncoded(label) < constants.PRIME);
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
      if (hasStarknetAddressShape(a)) {
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
