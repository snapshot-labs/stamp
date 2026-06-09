import { getAddress } from '@ethersproject/address';
import { max } from '../../constants.json';
import { withDeadline } from '../../helpers/deadline';
import { httpError } from '../../helpers/errors';
import { fetchHttpImage } from '../../helpers/http';
import { Address } from '../../helpers/types';

const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/user/bulk-by-address';
const API_KEY = process.env.NEYNAR_API_KEY ?? '';

interface UserDetails {
  pfp_url: string;
}

function withCache(url: string): string {
  return url.includes('imgur.com')
    ? `https://wrpcd.net/cdn-cgi/image/fit=contain,f=auto,w=${max}/${encodeURIComponent(url)}`
    : url;
}

function normalizeAddress(address: Address): Address | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

// The body read stays inside the deadline; moving it out leaves a stalled body unbounded.
async function fetchAddressImageUrl(normalizedAddress: string): Promise<string | null> {
  return withDeadline(async signal => {
    const response = await fetch(`${NEYNAR_API_URL}?addresses=${normalizedAddress}`, {
      headers: { Accept: 'application/json', api_key: API_KEY },
      signal
    });

    // Neynar answers 404 for an address with no Farcaster account, which is the
    // routine no-avatar case rather than a failure.
    if (response.status === 404) return null;
    if (!response.ok) throw httpError('farcaster', response.status, response.statusText);

    const data: Record<Address, UserDetails[]> = await response.json();

    return data[normalizedAddress.toLowerCase()]?.[0]?.pfp_url ?? null;
  });
}

export default async function resolve(address: string): Promise<Buffer | false> {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return false;

  const url = await fetchAddressImageUrl(normalizedAddress);
  if (!url) return false;

  return await fetchHttpImage(withCache(url));
}
