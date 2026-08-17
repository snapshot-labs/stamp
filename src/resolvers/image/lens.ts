import { getAddress, isAddress } from '@ethersproject/address';
import { graphQlCall } from '../../helpers/graphql';
import { fetchHttpImage } from '../../helpers/http';

const API_URL = 'https://api.lens.xyz';
const LENS_IPFS_GATEWAY = 'https://gw.ipfs-lens.dev/ipfs/';
const LENS_EXTENSION = '.lens';
const LOCAL_NAME_MAX_BYTES = 254;

function normalizeImageUrl(url: string) {
  if (!url) return false;

  // Lens IPFS gateway is returning 403 when accessed directly
  if (url.startsWith(LENS_IPFS_GATEWAY)) {
    return `https://${process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com'}/ipfs/${
      url.split(LENS_IPFS_GATEWAY)[1]
    }`;
  }

  // Return the URL as-is if it's not an IPFS URL
  return url;
}

export default async function resolve(domainOrAddress: string) {
  let request: Record<string, any>;

  if (isAddress(domainOrAddress)) {
    request = { address: getAddress(domainOrAddress) };
  } else if (domainOrAddress.endsWith(LENS_EXTENSION)) {
    const localName = domainOrAddress.split(LENS_EXTENSION)[0];
    if (!localName || Buffer.byteLength(localName) > LOCAL_NAME_MAX_BYTES) return false;

    request = { username: { localName } };
  } else {
    return false;
  }

  const {
    data: {
      data: { account }
    }
  } = await graphQlCall(
    `${API_URL}/graphql`,
    `query Account($request: AccountRequest!) {
      account(request: $request) {
        metadata {
          picture
        }
      }
    }`,
    { request }
  );

  const img_url = normalizeImageUrl(account?.metadata?.picture);
  if (!img_url) return false;

  return await fetchHttpImage(img_url);
}
