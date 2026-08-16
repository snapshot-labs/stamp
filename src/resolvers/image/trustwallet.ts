import { getAddress } from '@ethersproject/address';
import { fetchHttpImage } from '../../helpers/http';
import { chainIdToName, getBaseAssetIconUrl } from '../../utils';

const ETH = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
];

export default async function resolve(address, chainId) {
  const networkName = chainIdToName(chainId) || 'ethereum';
  const checksum = getAddress(address);

  let url = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${networkName}/assets/${checksum}/logo.png`;
  if (ETH.includes(checksum)) url = getBaseAssetIconUrl(chainId);

  return await fetchHttpImage(url);
}
