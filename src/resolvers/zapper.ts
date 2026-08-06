import { max } from '../constants.json';
import { chainIdToName, getBaseAssetIconUrl, resize } from '../utils';
import { fetchHttpImage, toChecksumAddress } from './utils';

const ETH = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
];

export default async function resolve(address, chainId) {
  const networkName = chainIdToName(chainId) || 'ethereum';
  const checksum = toChecksumAddress(address);

  if (!checksum) return false;

  let url = `https://storage.googleapis.com/zapper-fi-assets/tokens/${networkName}/${checksum.toLocaleLowerCase()}.png`;
  if (ETH.includes(checksum)) url = getBaseAssetIconUrl(chainId);

  const input = await fetchHttpImage(url);
  return await resize(input, max, max);
}
