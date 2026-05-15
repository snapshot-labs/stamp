import fetch from 'node-fetch';
import { getUrl, resize } from '../utils';
import { provider as getProvider } from '../addressResolvers/utils';
import { max } from '../constants.json';
import { fetchHttpImage } from './utils';

const DEFAULT_IMG_URL = 'https://starknet.id/api/identicons/0';
const provider = getProvider('0x534e5f4d41494e');

function isStarknetDomain(domain: string): boolean {
  return domain.endsWith('.stark');
}

function normalizeAddress(address: string): string {
  if (!address.match(/^(0x)?[0-9a-fA-F]{64}$/)) throw new Error('Invalid starknet address');

  return address;
}

async function getStarknetAddress(domain: string): Promise<string | null> {
  const address = await provider.getAddressFromStarkName(domain);

  return address === '0x0' ? null : address;
}

async function getImage(domainOrAddress: string): Promise<string | null> {
  const address = isStarknetDomain(domainOrAddress)
    ? await getStarknetAddress(domainOrAddress)
    : normalizeAddress(domainOrAddress);

  if (!address) return null;

  return (await provider.getStarkProfile(address))?.profilePicture ?? null;
}

export default async function resolve(domainOrAddress: string) {
  try {
    let img_url = await getImage(domainOrAddress);

    if (img_url === DEFAULT_IMG_URL) return false;

    if (img_url?.startsWith('https://api.starkurabu.com')) {
      const response = await fetch(img_url);
      const data = await response.json();

      img_url = data.image;
    }

    if (!img_url) return false;

    const input = await fetchHttpImage(getUrl(img_url));

    return await resize(input, max, max);
  } catch (e) {
    return false;
  }
}
