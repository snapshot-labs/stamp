import { getAddress } from '@ethersproject/address';
import { getUrl, graphQlCall } from '../utils';
import { fetchHttpImage } from './utils';
import { isStarknetAddress } from '../addressResolvers/utils';

const SUBGRAPH_URLS = ['https://api.snapshot.box', 'https://testnet-api.snapshot.box'];

async function getSpaceProperty(key: string, url: string, property: 'avatar' | 'cover') {
  const ids = [key];
  if (!isStarknetAddress(key)) {
    ids.push(getAddress(key));
  }

  const {
    data: {
      data: { spaces }
    }
  } = await graphQlCall(
    url,
    `query GetSpaces($ids: [String!]!) {
      spaces(where: { id_in: $ids }) {
        metadata {
          ${property}
        }
      }
    }`,
    { ids }
  );

  const result = spaces?.map(space => space.metadata?.[property]).filter(Boolean)[0];

  return result || Promise.reject(false);
}

function createPropertyResolver(property: 'avatar' | 'cover') {
  return async key => {
    try {
      const value = await Promise.any(
        SUBGRAPH_URLS.map(url => getSpaceProperty(key, url, property))
      );

      const url = getUrl(value);

      return await fetchHttpImage(url);
    } catch {
      return false;
    }
  };
}

export const resolveAvatar = createPropertyResolver('avatar');
export const resolveCover = createPropertyResolver('cover');
