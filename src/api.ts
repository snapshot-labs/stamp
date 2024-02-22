import express from 'express';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { parseQuery, resize, setHeader, getCacheKey } from './utils';
import { set, get, streamToBuffer, clear } from './aws';
import { resolve } from './resolvers';
import constants from './constants.json';
import { rpcError, rpcSuccess } from './helpers/utils';
import { lookupAddresses, resolveNames } from './addressResolvers';

const router = express.Router();
const TYPE_CONSTRAINTS = Object.keys(constants.resolvers).join('|');

router.post('/', async (req, res) => {
  const { id = null, method, params } = req.body;
  if (!method) return rpcError(res, 400, 'missing method', id);
  try {
    let result: any = {};
    if (!Array.isArray(params)) return rpcError(res, 400, 'params must be an array of string', id);

    if (method === 'lookup_addresses') result = await lookupAddresses(params);
    else if (method === 'resolve_names') result = await resolveNames(params);
    else return rpcError(res, 400, 'invalid method', id);

    if (result?.error) return rpcError(res, result.code || 500, result.error, id);
    return rpcSuccess(res, result, id);
  } catch (e) {
    const err = e as any;
    capture(err.error ? new Error(err.error) : err);
    return rpcError(res, 500, e, id);
  }
});

router.get(`/clear/:type(${TYPE_CONSTRAINTS})/:id`, async (req, res) => {
  const { type, id } = req.params;
  try {
    const { address, network, w, h, fallback, cb } = await parseQuery(id, type, {
      s: constants.max,
      fb: req.query.fb,
      cb: req.query.cb
    });
    const key = getCacheKey({ type, network, address, w, h, fallback, cb });
    const result = await clear(key);
    res.status(result ? 200 : 404).json({ status: result ? 'ok' : 'not found' });
  } catch (e) {
    capture(e);
    res.status(500).json({ status: 'error', error: 'failed to clear cache' });
  }
});

router.get(`/:type(${TYPE_CONSTRAINTS})/:id`, async (req, res) => {
  const { type, id } = req.params;
  let address, network, w, h, fallback, cb;

  try {
    ({ address, network, w, h, fallback, cb } = await parseQuery(id, type, req.query));
  } catch (e) {
    return res.status(500).json({ status: 'error', error: 'failed to load content' });
  }

  const key1 = getCacheKey({
    type,
    network,
    address,
    w: constants.max,
    h: constants.max,
    fallback,
    cb
  });
  const key2 = getCacheKey({ type, network, address, w, h, fallback, cb });

  // Check resized cache
  const cache = await get(`${key1}/${key2}`);
  if (cache) {
    // console.log('Got cache', address);
    setHeader(res);
    return cache.pipe(res);
  }

  // Check base cache
  const base = await get(`${key1}/${key1}`);
  let baseImage;
  if (base) {
    baseImage = await streamToBuffer(base);
  } else {
    const images = await resolve(type, address, network);
    baseImage = [...images].reverse().find(file => !!file);

    if (!baseImage) {
      const fallbackImage = (await resolve(type, address, network, [fallback]))[0];
      const resizedImage = await resize(fallbackImage, w, h);

      setHeader(res, 'SHORT_CACHE');
      return res.send(resizedImage);
    }
  }

  // Resize and return image
  const resizedImage = await resize(baseImage, w, h);
  setHeader(res);
  res.send(resizedImage);

  // Store cache
  try {
    if (!base) {
      await set(`${key1}/${key1}`, baseImage);
      console.log('Stored base cache', key1);
    }
    await set(`${key1}/${key2}`, resizedImage);
    console.log('Stored cache', address);
  } catch (e) {
    capture(e);
    console.log('Store cache failed', address, e);
  }
});

export default router;
