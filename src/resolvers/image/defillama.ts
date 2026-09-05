import { getAddress } from '@ethersproject/address';
import { isEvmAddress } from '../../helpers/address';
import { fetchHttpImage } from '../../helpers/http';

// DefiLlama keys token icons by numeric chain id and contract address, with no
// API key, and answers 404 for a token it does not carry.
export default async function resolve(address: string, chainId: string) {
  if (!/^\d+$/.test(chainId)) return false;
  if (!isEvmAddress(address)) return false;

  const checksum = getAddress(address);

  return await fetchHttpImage(`https://token-icons.llamao.fi/icons/tokens/${chainId}/${checksum}`);
}
