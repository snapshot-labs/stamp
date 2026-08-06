import { max } from '../constants.json';
import { resize } from '../utils';
import { fetchHttpImage, toChecksumAddress } from './utils';

const API_KEY = process.env.COINGECKO_API_KEY;

const COINGECKO_ASSET_PLATFORMS = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  137: 'polygon-pos',
  8453: 'base',
  33139: 'apechain',
  42161: 'arbitrum-one'
};

export default async function resolve(address: string, chainId: string) {
  if (!API_KEY) return false;

  const assetPlatformId = COINGECKO_ASSET_PLATFORMS[chainId];

  if (!assetPlatformId) return false;

  const checksum = toChecksumAddress(address);

  if (!checksum) return false;

  const url = `https://pro-api.coingecko.com/api/v3/coins/${assetPlatformId}/contract/${checksum}`;
  const response = await fetch(url, { headers: { 'x-cg-pro-api-key': API_KEY } });

  // CoinGecko knows no coin for this contract ({"error":"coin not found"}):
  // no data. Any other non-2xx is a real failure (a rejected API key answers
  // 401) and must be reported rather than read as an empty result.
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Invalid network response (${url} ${response.status})`);
  }

  const data = await response.json();

  // A coin with no image: no data, and fetchHttpImage(undefined) would throw
  // "Provided config url is not valid" as if the request had failed.
  if (!data?.image?.large) return false;

  const input = await fetchHttpImage(data.image.large);
  return await resize(input, max, max);
}
