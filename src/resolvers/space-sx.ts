import { max } from '../constants.json';
import { getUrl, graphQlCall, resize } from '../utils';
import { fetchHttpImage, spaceIds } from './utils';

const SUBGRAPH_URLS = ['https://api.snapshot.box', 'https://testnet-api.snapshot.box'];

async function getSpaceProperty(
  key: string,
  url: string,
  property: 'avatar' | 'cover'
): Promise<string | null> {
  const ids = spaceIds(key);
  if (!ids) return null;

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
    // A space lives on one of the two APIs, so "not here" is the normal answer
    // from the other one: a null, not a failure. A failure only costs us the
    // value when no API answered with one, and only then is it rethrown for
    // index.ts to report.
    const results = await Promise.allSettled(
      SUBGRAPH_URLS.map(url => getSpaceProperty(key, url, property))
    );

    const value = results
      .map(result => (result.status === 'fulfilled' ? result.value : null))
      .find(Boolean);

    if (!value) {
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (failure) throw failure.reason;

      return false;
    }

    const url = getUrl(value);
    const input = await fetchHttpImage(url);

    if (property === 'cover') return input;
    return await resize(input, max, max);
  };
}

export const resolveAvatar = createPropertyResolver('avatar');
export const resolveCover = createPropertyResolver('cover');
