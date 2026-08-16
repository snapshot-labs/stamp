import { graphQlCall } from '../../helpers/graphql';
import { fetchHttpImage, getUrl, spaceIds } from '../../helpers/http';

const SUBGRAPH_URLS = ['https://api.snapshot.box', 'https://testnet-api.snapshot.box'];

async function getSpaceProperty(
  ids: string[],
  url: string,
  property: 'avatar' | 'cover'
): Promise<string | null> {
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

  return spaces?.map(space => space.metadata?.[property]).filter(Boolean)[0] ?? null;
}

function createPropertyResolver(property: 'avatar' | 'cover') {
  return async key => {
    const ids = spaceIds(key);
    if (!ids) return false;

    const settled = await Promise.allSettled(
      SUBGRAPH_URLS.map(url => getSpaceProperty(ids, url, property))
    );
    const answers = settled.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : []
    );

    // One API down while the other answers "no such space" is still no-data.
    // Keeping that resilience is why both are asked at all.
    if (!answers.length) throw (settled[0] as PromiseRejectedResult).reason;

    const value = answers.find(Boolean);
    if (!value) return false;

    return await fetchHttpImage(getUrl(value));
  };
}

export const resolveAvatar = createPropertyResolver('avatar');
export const resolveCover = createPropertyResolver('cover');
