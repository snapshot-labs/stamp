import { DNSConnect } from '@webinterop/dns-connect';
import { Address, EMPTY_ADDRESS, Handle } from '../utils';
import constants from '../constants.json';

const MAINNET = '109';
const TESTNET = '157';
const TLD = 'shib';
const NETWORK = 'BONE';

const API_KEYS = {
  [MAINNET]: process.env.D3_API_KEY_MAINNET,
  [TESTNET]: process.env.D3_API_KEY_TESTNET
};

async function getClaimedOwner(handle: Handle, chainId: string): Promise<Address> {
  if (!handle.endsWith(`.${TLD}`) || !constants.d3[chainId]?.apiUrl || !API_KEYS[chainId])
    return EMPTY_ADDRESS;

  const response = await fetch(
    `${constants.d3[chainId].apiUrl}/v1/partner/token/${handle.replace(/\.shib$/, '')}/${TLD}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'Api-Key': API_KEYS[chainId]
      }
    }
  );

  if (response.status === 404) return EMPTY_ADDRESS;
  if (!response.ok) throw new Error(`Error fetching owner: ${response.statusText}`);

  const data = await response.json();

  if (data.status !== 'registered' || new Date(data.expirationDate) < new Date()) {
    return EMPTY_ADDRESS;
  }

  // owner field will be missing on unclaimed names
  return data.owner || '';
}

async function getResolvedAddress(handle: Handle, chainId: string): Promise<Address> {
  const dnsConnect = new DNSConnect({ dns: { forwarderDomain: constants.d3[chainId].forwarder } });

  return (await dnsConnect.resolve(handle, NETWORK)) || EMPTY_ADDRESS;
}

/**
 * Returns the owner of a Shibarium handle.
 * In case the name has not been claimed (when bought with a credit card),
 * it will return the resolved address.
 **/
export default async function getOwner(handle: Handle, chainId = MAINNET): Promise<Address> {
  const address = await getClaimedOwner(handle, chainId);

  if (address !== '') return address;

  return getResolvedAddress(handle, chainId);
}
