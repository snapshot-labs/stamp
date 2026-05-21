import snapshot from '@snapshot-labs/snapshot.js';
import { getAddress } from '@ethersproject/address';
import { Address, Handle, EMPTY_ADDRESS } from '../utils';

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

export function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses
    .map(a => {
      if (isStarknetAddress(a)) {
        return a.toLowerCase();
      }
      try {
        return getAddress(a.toLowerCase());
      } catch (e) {}
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
    ...(additionalMessages || [])
  ];
  return (
    messages.some(m => error.message?.includes(m) || error.error?.message?.includes(m)) ||
    ['TIMEOUT', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 504].some(c =>
      String(error.error?.code || error.error?.status || error.code || '').includes(String(c))
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
