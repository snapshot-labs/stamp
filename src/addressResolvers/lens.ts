import { capture } from '@snapshot-labs/snapshot-sentry';
import { FetchError, isEvmAddress, isSilencedError } from './utils';
import { Address, graphQlCall, Handle } from '../utils';

export const NAME = 'Lens';
const API_URL = 'https://api.lens.xyz/graphql';
// mute not fixable errors, since it's a public API
const MUTED_ERRORS = ['status code 503', 'status code 429'];

async function apiCall(filterName: string, filters: string[]) {
  const filterValue =
    filterName === 'addresses' ? filters : filters.map(h => ({ localName: h.replace(/"/g, '') }));

  const query = `query AccountBulk($request: AccountsBulkRequest!) {
    accountsBulk(request: $request) {
      username {
        localName
        ownedBy
      }
    }
  }`;

  const {
    data: {
      data: { accountsBulk }
    }
  } = await graphQlCall(API_URL, query, { request: { [filterName]: filterValue } });

  return accountsBulk;
}

function normalizeAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isEvmAddress);
}

function normalizeHandles(handles: Handle[]): Handle[] {
  return handles
    .map(h => (/^[a-z0-9-_]{5,31}\.lens$/.test(h) ? h.replace(/\.lens$/, '') : ''))
    .filter(h => h);
}

export async function lookupAddresses(addresses: Address[]): Promise<Record<Address, Handle>> {
  const normalizedAddresses = normalizeAddresses(addresses);

  if (normalizedAddresses.length === 0) return {};

  try {
    const accounts = await apiCall('addresses', normalizedAddresses);

    return (
      Object.fromEntries(
        accounts
          .filter(i => i.username)
          .map(i => [i.username.ownedBy, `${i.username.localName}.lens`])
      ) || {}
    );
  } catch (err) {
    if (!isSilencedError(err, MUTED_ERRORS)) {
      capture(err, { input: { addresses: normalizedAddresses } });
    }

    throw new FetchError();
  }
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const normalizedHandles = normalizeHandles(handles);

  if (normalizedHandles.length === 0) return {};

  try {
    const accounts = await apiCall('usernames', normalizedHandles);

    return (
      Object.fromEntries(accounts.map(i => [`${i.username.localName}.lens`, i.username.ownedBy])) ||
      {}
    );
  } catch (err) {
    if (!isSilencedError(err, MUTED_ERRORS)) {
      capture(err, { input: { handles: normalizedHandles } });
    }
    throw new FetchError();
  }
}
