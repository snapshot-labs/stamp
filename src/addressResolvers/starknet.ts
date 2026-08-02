import { provider as getProvider, isStarknetAddress, withoutEmptyValues } from './utils';
import { Address, Handle } from '../utils';

export const NAME = 'Starknet';
const NETWORK = '0x534e5f4d41494e';
const NOT_FOUND_ERROR = 'Starkname not found';
const EMPTY_STARKNET_ADDRESS = '0x0';
const provider = getProvider(NETWORK);

function padAddress(address: Address): Address {
  return `0x${address.replace(/^0x/, '').padStart(64, '0')}`;
}

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isStarknetAddress);
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => h.endsWith('.stark'));
}

async function resolveEach(
  needles: string[],
  lookup: (needle: string) => Promise<string | undefined>
): Promise<Record<string, string>> {
  const values = await Promise.all(
    needles.map(async needle => {
      try {
        return await lookup(needle);
      } catch (err: any) {
        if (err?.message?.includes(NOT_FOUND_ERROR)) return undefined;
        throw err;
      }
    })
  );

  return withoutEmptyValues(Object.fromEntries(needles.map((needle, i) => [needle, values[i]])));
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  return await resolveEach(normalizedAddresses, address => provider.getStarkName(address));
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  return await resolveEach(normalizedHandles, async handle => {
    const address = await provider.getAddressFromStarkName(handle);

    return !address || address === EMPTY_STARKNET_ADDRESS ? undefined : padAddress(address);
  });
}
