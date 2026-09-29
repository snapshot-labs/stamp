import { getAddress, isAddress } from '@ethersproject/address';
import { chainIdToName, getBaseAssetIconUrl } from '../../helpers/chains';
import { fetchHttpImage } from '../../helpers/http';

const ETH = [
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
];

export default async function resolve(address: string, chainId: string) {
  if (!isAddress(address)) return false;

  const networkName = chainIdToName(chainId) || 'ethereum';
  const checksum = getAddress(address);

  if (ETH.includes(checksum)) {
    const url = getBaseAssetIconUrl(chainId);
    return url ? await fetchHttpImage(url) : false;
  }

  return await fetchHttpImage(
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${networkName}/assets/${checksum}/logo.png`
  );
}
