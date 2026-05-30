import { capture } from '@snapshot-labs/snapshot-sentry';
import express from 'express';
import { clearCache, lookupAddresses, resolveNames } from './addressResolvers';
import { clear, get, set, streamToBuffer } from './aws';
import constants from './constants.json';
import getOwner from './getOwner';
import { rpcError, rpcSuccess } from './helpers/utils';
import lookupDomains from './lookupDomains';
import resolvers from './resolvers';
import { getCacheKey, parseQuery, resize, ResolverType, setHeader } from './utils';

const router = express.Router();
const TYPE_CONSTRAINTS = [...Object.keys(constants.resolvers), 'address', 'name'].join('|');

router.post('/', async (req, res) => {
  const { id = null, method, params } = req.body;
  if (!method) return rpcError(res, 400, 'missing method', id);
  try {
    let result: any = {};

    if (method === 'lookup_domains') {
      result = await lookupDomains(params, req.body.network);
    } else if (method === 'get_owner') {
      result = await getOwner(params, req.body.network);
    } else if (['lookup_addresses', 'resolve_names'].includes(method)) {
      if (!Array.isArray(params))
        return rpcError(res, 400, 'params must be an array of string', id);

      if (method === 'lookup_addresses') result = await lookupAddresses(params);
      else result = await resolveNames(params);
    } else return rpcError(res, 400, 'invalid method', id);

    if (result?.error) return rpcError(res, result.code || 500, result.error, id);
    return rpcSuccess(res, result, id);
  } catch (err) {
    const error = err as any;
    if (error.code !== 400) {
      capture(error.error ? new Error(error.error) : error);
    }
    return rpcError(res, 500, err, id);
  }
});

router.get(`/clear/:type(${TYPE_CONSTRAINTS})/:id`, async (req, res) => {
  const { type, id } = req.params as { type: ResolverType; id: string };

  try {
    let result = false;

    if (type === 'address' || type === 'name') {
      result = await clearCache(id, type);
    } else {
      const { address, network, w, h, fallback, cb, fit } = await parseQuery(id, type, {
        s: constants.max,
        fb: req.query.fb,
        cb: req.query.cb,
        fit: req.query.fit
      });
      const key = getCacheKey({ type, network, address, w, h, fallback, cb, fit });
      result = await clear(key);
    }
    res.status(result ? 200 : 404).json({ status: result ? 'ok' : 'not found' });
  } catch (err) {
    capture(err);
    res.status(500).json({ status: 'error', error: 'failed to clear cache' });
  }
});

router.get(`/:type(${TYPE_CONSTRAINTS})/:id`, async (req, res) => {
  const { type, id } = req.params as { type: ResolverType; id: string };
  let address, network, networkId, w, h, fallback, cb, resolver, fit;

  try {
    ({ address, network, networkId, w, h, fallback, cb, resolver, fit } = await parseQuery(
      id,
      type,
      req.query
    ));
  } catch {
    return res.status(500).json({ status: 'error', error: 'failed to load content' });
  }

  const disableCache = !!resolver;

  const key1 = getCacheKey({
    type,
    network,
    address,
    w: constants.max,
    h: constants.max,
    fallback,
    cb,
    fit
  });
  const key2 = getCacheKey({ type, network, address, w, h, fallback, cb, fit });

  // Check resized cache
  const cache = await get(`${key1}/${key2}`);
  if (cache && !disableCache) {
    // console.log('Got cache', address);
    setHeader(res);
    return cache.pipe(res);
  }

  // Check base cache
  const base = await get(`${key1}/${key1}`);
  let baseImage;
  if (base) {
    baseImage = await streamToBuffer(base);
    // console.log('Got base cache');
  } else {
    // console.log('No cache for', key1, base);

    let currentResolvers: string[] = constants.resolvers.avatar;
    if (type === 'token') currentResolvers = constants.resolvers.token;
    if (type === 'space') currentResolvers = constants.resolvers.space;
    if (type === 'space-cover') currentResolvers = constants.resolvers['space-cover'];
    if (type === 'space-logo') currentResolvers = constants.resolvers['space-logo'];
    if (type === 'space-sx') currentResolvers = constants.resolvers['space-sx'];
    if (type === 'space-cover-sx') currentResolvers = constants.resolvers['space-cover-sx'];
    if (type === 'user-cover') currentResolvers = constants.resolvers['user-cover'];

    if (resolver) {
      if (!currentResolvers.includes(resolver)) {
        return res.status(500).json({ status: 'error', error: 'invalid resolvers' });
      }

      currentResolvers = [resolver];
    }

    const files = await Promise.all(
      currentResolvers.map(r => resolvers[r](address, network, networkId))
    );
    baseImage = files.find(Boolean);

    if (!baseImage) {
      const fallbackImage = await resolvers[fallback](address, network, networkId);
      const resizedImage = await resize(fallbackImage, w, h, { fit });

      setHeader(res, 'SHORT_CACHE');
      return res.send(resizedImage);
    }
  }

  // Resize and return image
  const resizedImage = await resize(baseImage, w, h, { fit });
  setHeader(res);
  res.send(resizedImage);

  if (disableCache) return;

  // Store cache
  try {
    if (!base) {
      await set(`${key1}/${key1}`, baseImage);
      console.log('Stored base cache', key1);
    }
    await set(`${key1}/${key2}`, resizedImage);
    console.log('Stored cache', address);
  } catch (err) {
    capture(err);
    console.log('Store cache failed', address, err);
  }
});

export default router;
