import { getAddress } from '@ethersproject/address';
import { withDeadline } from '../../helpers/deadline';
import { httpError } from '../../helpers/errors';
import { fetchHttpImage, isHttpUrl } from '../../helpers/http';

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

  const checksum = getAddress(address);
  const url = `https://pro-api.coingecko.com/api/v3/coins/${assetPlatformId}/contract/${checksum}`;

  // The body read is inside the deadline, not just the request: the response
  // settles as soon as the headers land, so a budget ending at the request would
  // leave a stalled body unbounded.
  const data = await withDeadline(async signal => {
    const response = await fetch(url, { headers: { 'x-cg-pro-api-key': API_KEY }, signal });

    if (response.status === 404) return null;
    if (!response.ok) throw httpError('coingecko', response.status, response.statusText);

    return await response.json();
  });

  if (!data?.image?.large || !isHttpUrl(data.image.large)) return false;

  return await fetchHttpImage(data.image.large);
}
