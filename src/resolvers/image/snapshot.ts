import { getAddress } from '@ethersproject/address';
import { defaultOffchainNetwork, offchainNetworks } from '../../constants.json';
import { isStarknetFelt } from '../../helpers/address';
import { graphQlCall } from '../../helpers/graphql';
import { fetchHttpImage, getUrl, spaceIds } from '../../helpers/http';

const UNIFIED_API_URL = 'https://api.snapshot.box';
const UNIFIED_API_TESTNET_URL = 'https://testnet-api.snapshot.box';

const API_URLS = {
  s: `${process.env.HUB_URL ?? 'https://hub.snapshot.org'}/graphql`,
  's-tn': `${process.env.HUB_URL_TN ?? 'https://testnet.hub.snapshot.org'}/graphql`,
  // SX mainnets
  eth: UNIFIED_API_URL,
  arb1: UNIFIED_API_URL,
  oeth: UNIFIED_API_URL,
  base: UNIFIED_API_URL,
  bnb: UNIFIED_API_URL,
  mnt: UNIFIED_API_URL,
  ape: UNIFIED_API_URL,
  sn: UNIFIED_API_URL,
  // SX testnets
  sep: UNIFIED_API_TESTNET_URL,
  curtis: UNIFIED_API_TESTNET_URL,
  bnbt: UNIFIED_API_TESTNET_URL,
  'sn-sep': UNIFIED_API_TESTNET_URL
};

type Entity = 'user' | 'space';
type Property = 'avatar' | 'cover' | 'logo';

const QUERIES = {
  avatar: {
    query: 'avatar',
    extract: (data: any) => data?.avatar
  },
  cover: {
    query: 'cover',
    extract: (data: any) => data?.cover
  },
  logo: {
    query: 'skinSettings { logo }',
    extract: (data: any) => data?.skinSettings?.logo
  }
};

async function getOffchainProperty(
  networkId: string,
  id: string,
  entity: Entity,
  property: Property
) {
  const {
    data: { entry }
  } = await graphQlCall(
    API_URLS[networkId],
    `query GetEntry($id: String!) {
      entry: ${entity}(id: $id) {
        ${QUERIES[property].query}
      }
    }`,
    { id },
    {
      headers: { 'x-api-key': process.env.HUB_API_KEY }
    }
  );

  return QUERIES[property].extract(entry);
}

async function getOnchainProperty(
  networkId: string,
  id: string,
  entity: Entity,
  property: Property
) {
  // The onchain API's SpaceMetadataItem carries no logo field, so asking for
  // one is a guaranteed validation error rather than a miss.
  if (property === 'logo') return null;

  const ids = spaceIds(id);
  if (!ids) return null;

  const {
    data: { spaces }
  } = await graphQlCall(
    API_URLS[networkId],
    `query GetSpaces($ids: [String!]!) {
      spaces(where: { id_in: $ids }) {
        metadata {
          ${property}
        }
      }
    }`,
    { ids }
  );

  return spaces?.map(space => space.metadata?.[property]).filter(Boolean)[0];
}

function normalizeUserId(value: string): string | null {
  try {
    return getAddress(value);
  } catch {
    return isStarknetFelt(value) ? value : null;
  }
}

function normalizeSpaceId(value: string) {
  try {
    return getAddress(value);
  } catch {
    return value;
  }
}

function createPropertyResolver(entity: Entity, property: Property) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (address: string, chainId = 1, networkId = defaultOffchainNetwork) => {
    let value = null;

    if (!Object.keys(API_URLS).includes(networkId)) return false;

    if (offchainNetworks.includes(networkId) || entity === 'user') {
      const id = entity === 'user' ? normalizeUserId(address) : normalizeSpaceId(address);
      if (!id) return false;

      value = await getOffchainProperty(
        offchainNetworks.includes(networkId) ? networkId : defaultOffchainNetwork,
        id,
        entity,
        property
      );
    } else {
      value = await getOnchainProperty(networkId, address, entity, property);
    }

    if (!value) return false;

    const url = getUrl(value);
    if (!url) return false;

    return await fetchHttpImage(url);
  };
}

export const resolveUserAvatar = createPropertyResolver('user', 'avatar');
export const resolveUserCover = createPropertyResolver('user', 'cover');
export const resolveSpaceAvatar = createPropertyResolver('space', 'avatar');
export const resolveSpaceCover = createPropertyResolver('space', 'cover');
export const resolveSpaceLogo = createPropertyResolver('space', 'logo');
