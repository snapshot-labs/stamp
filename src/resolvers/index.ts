import blockie from './blockie';
import jazzicon from './jazzicon';
import ens from './ens';
import trustwallet from './trustwallet';
import snapshot from './snapshot';
import space from './space';
import { resolveAvatar as sxResolveAvatar, resolveCover as sxResolveCover } from './space-sx';
import selfid from './selfid';
import lens from './lens';
import zapper from './zapper';
import constants from '../constants.json';
import { timeImageResolverResponse } from '../helpers/metrics';

const RESOLVERS = {
  blockie,
  jazzicon,
  ens,
  trustwallet,
  snapshot,
  space,
  'space-sx': sxResolveAvatar,
  'space-cover-sx': sxResolveCover,
  selfid,
  lens,
  zapper
} as const;

export function resolve(
  type: string,
  address: string,
  network: string,
  resolvers?: string[]
): Promise<any> {
  const _resolvers: string[] =
    resolvers ?? (constants.resolvers[type] || constants.resolvers.avatar);

  return Promise.all(
    _resolvers.map(async r => {
      const end = timeImageResolverResponse.startTimer({ provider: r });
      const result = await RESOLVERS[r](address, network);

      end({ status: result === false ? 0 : 1 });
      return result;
    })
  );
}

export default RESOLVERS;
