import { capture } from '@snapshot-labs/snapshot-sentry';
import { Address, Handle, FetchError, isSilencedError, isEvmAddress } from './utils';
import { getAddress } from '@ethersproject/address';
import fetch from 'node-fetch';

export const NAME = 'Farcaster';
const FNAMES_API_URL = 'https://fnames.farcaster.xyz/transfers?name=';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/user/';
const API_KEY = process.env.NEYNAR_API_KEY ?? '';

interface UserDetails {
  username: Handle;
  verified_addresses: {
    eth_addresses: Address[];
    sol_addresses: string[];
  };
  pfp_url: string;
}

interface ApiResponse {
  [address: string]: UserDetails[];
}

interface UserResult {
  username?: Handle;
  eth_addresses?: Address[];
  sol_addresses?: string[];
  pfp_url?: string;
}

async function fetchData<T>(url: string): Promise<T> {
  const headers = {
    Accept: 'application/json',
    api_key: API_KEY
  };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const e = new FetchError(`Failed to fetch data from the API. Status: ${response.status}`);
    if (!isSilencedError(e)) {
      capture(e, { tags: { issue: 'api_fetch_failure' } });
    }
    throw e;
  }
  return response.json() as Promise<T>;
}

function isValidUserData(data: any): boolean {
  return Array.isArray(data) && data.length > 0 && data[0].username;
}

function formatUserDetails(userDetails: { users: UserDetails[] }): UserResult {
  const user = userDetails.users[0];
  return {
    username: user.username,
    eth_addresses: user.verified_addresses.eth_addresses.filter(isEvmAddress),
    sol_addresses: user.verified_addresses.sol_addresses,
    pfp_url: user.pfp_url
  };
}

async function getUserDetails(username: Handle): Promise<{ users: UserDetails[] } | null> {
  const transferData = await fetchData<{ transfers: any[] }>(`${FNAMES_API_URL}${username}`);
  if (transferData.transfers.length > 0) {
    const userDetails = await fetchData<{ result: { users: UserDetails[] } }>(
      `${NEYNAR_API_URL}search?q=${username}&viewer_fid=197049`
    );
    if (userDetails.result && userDetails.result.users.length > 0) {
      return userDetails.result;
    }
  }
  return null;
}

function handleUserDetailsError(e: any, username: Handle): void {
  if (!isSilencedError(e)) {
    capture(e, { input: { username }, tags: { issue: 'fetch_user_details_failure' } });
  }
  throw new FetchError(`Error fetching user details for ${username}.`);
}

async function fetchUserDetailsByUsername(username: Handle): Promise<UserResult | null> {
  try {
    const userDetails = await getUserDetails(username);
    if (userDetails) {
      return formatUserDetails(userDetails);
    }
  } catch (e) {
    handleUserDetailsError(e, username);
  }
  return null;
}

function buildLookupUrl(addresses: Address[]): string {
  const filteredAddresses = addresses.filter(isEvmAddress);
  if (filteredAddresses.length === 0) {
    throw new FetchError('No valid Ethereum addresses provided.');
  }
  const addressesQuery = filteredAddresses.join(',');
  return `${NEYNAR_API_URL}bulk-by-address?addresses=${addressesQuery}`;
}

function processUserDetails(userDetails: ApiResponse, results: { [key: Handle]: Address }): void {
  for (const [address, data] of Object.entries(userDetails)) {
    if (isValidUserData(data)) {
      const checksumAddress = getAddress(address);
      results[checksumAddress] = `${data[0].username}.fcast.id`;
    }
  }
}

function handleLookupError(e: any, addresses: Address[]): void {
  if (!isSilencedError(e)) {
    capture(e, { input: { addresses }, tags: { issue: 'lookup_addresses_failure' } });
  }
  throw new FetchError('No user found for this address.');
}

export async function resolveNames(handles: Handle[]): Promise<Record<Handle, Address>> {
  const results: Record<Handle, Address> = {};
  for (const handle of handles) {
    const normalizedHandle = handle.replace('.fcast.id', '');
    try {
      const userDetails = await fetchUserDetailsByUsername(normalizedHandle);
      if (userDetails && userDetails.eth_addresses) {
        results[handle] = getAddress(userDetails.eth_addresses[0]);
      }
    } catch (e) {
      console.error(`Error resolving name for handle ${handle}:`, e);
    }
  }
  return results;
}

export async function lookupAddresses(addresses: Address[]): Promise<{ [key: Handle]: Address }> {
  const results: { [key: Handle]: Address } = {};
  try {
    const url = buildLookupUrl(addresses);
    const userDetails = await fetchData<ApiResponse>(url);
    processUserDetails(userDetails, results);
  } catch (e) {
    handleLookupError(e, addresses);
  }
  return results;
}
