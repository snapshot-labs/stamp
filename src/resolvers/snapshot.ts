import { getAddress } from '@ethersproject/address';
import { getUrl, graphQlCall, resize } from '../utils';
import { max, offchainNetworks, defaultOffchainNetwork } from '../constants.json';
import { fetchHttpImage } from './utils';
import { isStarknetAddress } from '../addressResolvers/utils';

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
  mnt: UNIFIED_API_URL,
  ape: UNIFIED_API_URL,
  sn: UNIFIED_API_URL,
  // SX testnets
  sep: UNIFIED_API_TESTNET_URL,
  curtis: UNIFIED_API_TESTNET_URL,
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
    data: {
      data: { entry }
    }
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
  const ids = [id];
  if (!isStarknetAddress(id)) {
    ids.push(getAddress(id));
  }

  const {
    data: {
      data: { spaces }
    }
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

function createPropertyResolver(entity: Entity, property: Property) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (address: string, chainId = 1, networkId = defaultOffchainNetwork) => {
    let value = null;

    if (!Object.keys(API_URLS).includes(networkId)) return false;

    try {
      if (offchainNetworks.includes(networkId) || entity === 'user') {
        value = await getOffchainProperty(
          offchainNetworks.includes(networkId) ? networkId : defaultOffchainNetwork,
          address,
          entity,
          property
        );
      } else {
        value = await getOnchainProperty(networkId, address, entity, property);
      }

      if (!value) return false;

      const url = getUrl(value);
      const input = await fetchHttpImage(url);

      if (['cover', 'logo'].includes(property)) return input;

      return await resize(input, max, max);
    } catch (e) {
      return false;
    }
  };
}

export const resolveUserAvatar = createPropertyResolver('user', 'avatar');
export const resolveUserCover = createPropertyResolver('user', 'cover');
export const resolveSpaceAvatar = createPropertyResolver('space', 'avatar');
export const resolveSpaceCover = createPropertyResolver('space', 'cover');
export const resolveSpaceLogo = createPropertyResolver('space', 'logo');
