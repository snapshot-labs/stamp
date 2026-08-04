import axios from 'axios';
import { isStarknetAddress, withoutEmptyValues } from './utils';
import { Address, Handle } from '../utils';

export const NAME = 'Starknet';
const BASE_URL = 'https://api.starknet.id';

type RESOLVE_TYPE = 'addr_to_domain' | 'domain_to_addr';

function buildApiUrl(resolve_type: RESOLVE_TYPE, needle: string): string {
  return `${BASE_URL}/${resolve_type}?${
    resolve_type === 'addr_to_domain' ? 'addr' : 'domain'
  }=${needle}`;
}

async function apiCall(
  resolve_type: RESOLVE_TYPE,
  needles: string[]
): Promise<Record<string, string>> {
  const requests = needles.map(needle =>
    axios.get(buildApiUrl(resolve_type, needle), { timeout: 5e3 })
  );
  const responses = await Promise.allSettled(requests);

  return withoutEmptyValues(
    Object.fromEntries(
      needles.map((needle, i) => {
        const response = responses[i];
        let value: string | undefined;

        if (response.status === 'fulfilled') {
          value = response.value.data[resolve_type === 'addr_to_domain' ? 'domain' : 'addr'];
        }

        return [needle, value];
      })
    )
  );
}

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isStarknetAddress);
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles.filter(h => h.endsWith('.stark'));
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  return await apiCall('addr_to_domain', normalizedAddresses);
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  return await apiCall('domain_to_addr', normalizedHandles);
}
