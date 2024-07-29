import axios from 'axios';
import { getUrl, resize } from '../utils';
import { max } from '../constants.json';
import { fetchHttpImage, axiosDefaultParams } from './utils';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.snapshot.org';
const HUB_API_KEY = process.env.HUB_API_KEY ?? undefined;

function createPropertyResolver(property: 'avatar' | 'cover') {
  return async (address: string) => {
    try {
      const headers: Record<string, string> = HUB_API_KEY ? { 'x-api-key': HUB_API_KEY } : {};
      const user = (
        await axios({
          url: `${HUB_URL}/graphql`,
          method: 'post',
          data: {
            query: `query { user(id: "${address}") { ${property} } }`
          },
          headers,
          ...axiosDefaultParams
        })
      ).data.data.user;

      if (!user?.[property]) return false;

      const url = getUrl(user[property]);
      const input = await fetchHttpImage(url);

      if (property === 'cover') return input;

      return await resize(input, max, max);
    } catch (e) {
      return false;
    }
  };
}

export const resolveAvatar = createPropertyResolver('avatar');
export const resolveCover = createPropertyResolver('cover');
