import { getAddress } from '@ethersproject/address';
import { max } from '../constants.json';
import { chainIdToName, getBaseAssetIconUrl, resize } from '../utils';
import { fetchHttpImage } from './utils';

const ETH = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
];

export default async function resolve(address, chainId) {
  try {
    const networkName = chainIdToName(chainId) || 'ethereum';
    const checksum = getAddress(address);

    let url = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${networkName}/assets/${checksum}/logo.png`;
    if (ETH.includes(checksum)) url = getBaseAssetIconUrl(chainId);

    const input = await fetchHttpImage(url);
    return await resize(input, max, max);
  } catch {
    return false;
  }
}
