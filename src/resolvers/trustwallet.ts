import { max } from '../constants.json';
import { chainIdToName, getBaseAssetIconUrl, resize } from '../utils';
import { fetchHttpImage, HTTP_404_ERROR, toChecksumAddress } from './utils';

const ETH = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
];

// The assets repo answers 404 for every token it has no logo for, which is most
// of them. That is the normal no-logo path, not a failure.
export const MUTED_ERRORS = [HTTP_404_ERROR];

export default async function resolve(address, chainId) {
  const networkName = chainIdToName(chainId) || 'ethereum';
  const checksum = toChecksumAddress(address);

  if (!checksum) return false;

  let url = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${networkName}/assets/${checksum}/logo.png`;
  if (ETH.includes(checksum)) url = getBaseAssetIconUrl(chainId);

  const input = await fetchHttpImage(url);
  return await resize(input, max, max);
}
