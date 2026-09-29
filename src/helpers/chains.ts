// Deep import: `networks` is not on snapshot.js's public export, but `src/` is
// published. Keeping it here leaves one line to fix if a major relocates it.
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import chains from '../chains.json';

// A chain snapshot.js does not know counts as mainnet. Every chain a resolver
// serves is listed today, so this only fires for one added ahead of snapshot.js.
export function isTestnet(chainId: string): boolean {
  return !!(networks as Record<string, { testnet?: boolean }>)[chainId]?.testnet;
}

export function shortNameToChainId(shortName: string): string | null {
  return shortName in chains.SHORTNAME_TO_CHAIN_ID ? chains.SHORTNAME_TO_CHAIN_ID[shortName] : null;
}

export function chainIdToShortName(chainId: string): string | null {
  return chainId in chains.CHAIN_ID_TO_SHORTNAME ? chains.CHAIN_ID_TO_SHORTNAME[chainId] : null;
}

export function chainIdToName(chainId: string): string | null {
  if (chainId === '1') return 'ethereum';
  if (chainId === '56') return 'smartchain';
  if (chainId === '100') return 'xdai';
  if (chainId === '250') return 'fantom';
  if (chainId === '137') return 'polygon';
  if (chainId === '42161') return 'arbitrum';
  return null;
}

// Chains from snapshot.js networks whose native currency is ETH
const ETH_NATIVE_CHAIN_IDS = new Set([
  '1',
  '10',
  '169',
  '291',
  '300',
  '324',
  '1101',
  '7560',
  '8453',
  '26514',
  '42161',
  '42170',
  '57073',
  '59141',
  '59144',
  '81457',
  '84532',
  '763373',
  '810180',
  '810181',
  '2651420',
  '11155111',
  '11155420',
  '111557560',
  '168587773',
  '1313161554'
]);

export const getBaseAssetIconUrl = (chainId: string): string | null => {
  // BNB
  if (chainId === '56')
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png';
  if (chainId === '100')
    return 'https://ipfs.snapshot.box/ipfs/bafkreie4u6cq3o6sarxti5r6riekkimr33fjnu4bw6vhnqcsijvzpxjesm';
  // Matic
  if (chainId === '137')
    return 'https://github-production-user-asset-6210df.s3.amazonaws.com/1968722/269347324-fc34c3a3-01e8-424a-80f6-0910374ea6de.svg';
  if (chainId === '5000')
    return 'https://ipfs.snapshot.box/ipfs/bafkreidkucwfn4mzo2gtydrt2wogk3je5xpugom67vhi4h4comaxxjzoz4';
  // Apechain & Curtis
  if (chainId === '33139' || chainId === '33111')
    return 'https://ipfs.snapshot.box/ipfs/bafybeifjxd2q2znrqdsl5y2oplp6yothjfpzaosxs3kcvnxcacox6wfl5u';
  // Celo
  if (chainId === '42220')
    return 'https://ipfs.snapshot.box/ipfs/bafkreidvcofeczigbjr7ddapgdugwso6v2l4iolfxys7qg6kfvu2uduyva';
  if (ETH_NATIVE_CHAIN_IDS.has(chainId))
    return 'https://static.cdnlogo.com/logos/e/81/ethereum-eth.svg';
  return null;
};
