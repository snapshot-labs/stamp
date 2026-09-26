import constants from '../../constants.json';
import { chainIdToShortName, shortNameToChainId } from '../../helpers/chains';
import { ResolverType } from '../../helpers/types';
import { imageQuerySchema } from '../../helpers/validation';

export function parseQuery(id: string, type: ResolverType, query) {
  id = id.trim().toLowerCase();
  let address = id;
  let network = '1';
  let networkId: string | undefined = undefined;
  const chunks = id.split(':').map(chunk => chunk.trim());
  if (chunks.length === 2) {
    address = chunks[1];
    networkId = chunks[0];
    network = shortNameToChainId(networkId) || '1';
  } else if (chunks.length === 3) {
    address = chunks[2];
    network = chunks[1];
    networkId = chainIdToShortName(network) || 'eth';
  }

  address = address.toLowerCase();
  const typeResolvers: string[] =
    constants.resolvers[type as keyof typeof constants.resolvers] ?? constants.resolvers.avatar;
  const { s, w, h, fb, cb, fit, resolver } = imageQuerySchema(type, typeResolvers).parse(query);

  return {
    address,
    network,
    networkId,
    w: w ?? s,
    h: h ?? s,
    fallback: fb as string,
    cb,
    resolver,
    resolvers: resolver ? [resolver] : typeResolvers,
    fit
  };
}
