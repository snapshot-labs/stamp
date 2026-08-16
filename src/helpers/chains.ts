import chains from '../chains.json';

export function shortNameToChainId(shortName: string): string | null {
  return shortName in chains.SHORTNAME_TO_CHAIN_ID ? chains.SHORTNAME_TO_CHAIN_ID[shortName] : null;
}

export function chainIdToShortName(chainId: string): string | null {
  return chainId in chains.CHAIN_ID_TO_SHORTNAME ? chains.CHAIN_ID_TO_SHORTNAME[chainId] : null;
}

export function chainIdToName(chainId: string): string | null {
  if (chainId === '1') return 'ethereum';
  if (chainId === '56') return 'binance';
  if (chainId === '250') return 'fantom';
  if (chainId === '137') return 'polygon';
  if (chainId === '42161') return 'arbitrum';
  return null;
}

export const getBaseAssetIconUrl = (chainId: string) => {
  if (chainId === '100')
    return 'https://ipfs.snapshot.box/ipfs/bafkreie4u6cq3o6sarxti5r6riekkimr33fjnu4bw6vhnqcsijvzpxjesm';
  if (chainId === '137')
    return 'https://github-production-user-asset-6210df.s3.amazonaws.com/1968722/269347324-fc34c3a3-01e8-424a-80f6-0910374ea6de.svg';
  if (chainId === '5000')
    return 'https://ipfs.snapshot.box/ipfs/bafkreidkucwfn4mzo2gtydrt2wogk3je5xpugom67vhi4h4comaxxjzoz4';
  if (chainId === '33139' || chainId === '33111')
    return 'https://ipfs.snapshot.box/ipfs/bafybeifjxd2q2znrqdsl5y2oplp6yothjfpzaosxs3kcvnxcacox6wfl5u';
  if (chainId === '42220')
    return 'https://ipfs.snapshot.box/ipfs/bafkreidvcofeczigbjr7ddapgdugwso6v2l4iolfxys7qg6kfvu2uduyva';
  return 'https://static.cdnlogo.com/logos/e/81/ethereum-eth.svg';
};
