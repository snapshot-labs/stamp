import { getAddress } from '@ethersproject/address';
import fetch from 'node-fetch';
import { max } from '../constants.json';
import { Address, resize } from '../utils';
import { fetchHttpImage } from './utils';

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

async function fetchAddressImageUrl(normalizedAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`${NEYNAR_API_URL}?addresses=${normalizedAddress}`, {
      headers: { Accept: 'application/json', api_key: API_KEY }
    });

    if (!response.ok) {
      throw new Error(`Invalid network response (${response.url} ${response.status})`);
    }

    const data: Record<Address, UserDetails[]> = await response.json();

    return data[normalizedAddress.toLowerCase()]?.[0].pfp_url;
  } catch {
    return null;
  }
}

export default async function resolve(address: string): Promise<Buffer | false> {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return false;

  const url = await fetchAddressImageUrl(normalizedAddress);
  if (!url) return false;

  try {
    const imageUrl = withCache(url);
    const input = await fetchHttpImage(imageUrl);
    return await resize(input, max, max);
  } catch {
    return false;
  }
}
