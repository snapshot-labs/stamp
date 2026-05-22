import axios from 'axios';
import { getUrl, resize } from '../utils';
import { provider as getProvider } from '../addressResolvers/utils';
import { max } from '../constants.json';
import { axiosDefaultParams, fetchHttpImage } from './utils';

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

async function fetchImageOrMetadata(url: string): Promise<Buffer | { image?: string }> {
  const response = await axios({
    url,
    responseType: 'arraybuffer',
    ...axiosDefaultParams
  });
  const contentType: string = response.headers['content-type'] || '';
  const data = Buffer.from(response.data);
  if (contentType.includes('application/json')) {
    return JSON.parse(data.toString('utf-8'));
  }
  return data;
}

export default async function resolve(domainOrAddress: string) {
  try {
    const img_url = await getImage(domainOrAddress);

    if (!img_url || img_url === DEFAULT_IMG_URL) return false;

    const fetched = await fetchImageOrMetadata(getUrl(img_url));
    const buffer = Buffer.isBuffer(fetched)
      ? fetched
      : fetched.image
      ? await fetchHttpImage(getUrl(fetched.image))
      : null;

    if (!buffer) return false;

    return await resize(buffer, max, max);
  } catch (e) {
    return false;
  }
}
