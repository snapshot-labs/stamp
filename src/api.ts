import { capture } from '@snapshot-labs/snapshot-sentry';
import express from 'express';
import { z } from 'zod';
import constants from './constants.json';
import { parseQuery, setHeader } from './helpers/api';
import { isSilencedError, isTransportFailure } from './helpers/errors';
import { resize } from './helpers/image';
import { rpcError, rpcInvalidParams, rpcSuccess } from './helpers/rpc';
import { ResolverType } from './helpers/types';
import { formatZodError, schemas } from './helpers/validation';
import { clearCache, lookupAddresses, resolveNames } from './resolvers/address';
import getOwner from './resolvers/getOwner';
import resolvers from './resolvers/image';
import cache, { clear as clearImageCache } from './resolvers/image/cache';
import lookupDomains from './resolvers/lookupDomains';

const router = express.Router();
const TYPE_CONSTRAINTS = [...Object.keys(constants.resolvers), 'address', 'name'].join('|');
type Params = { [M in keyof typeof schemas]: z.infer<(typeof schemas)[M]> };

// Indexing `schemas` directly in dispatch does not typecheck: this mapped type keeps
// the parsed params correlated with the method they are passed to.
const paramSchemas: { [M in keyof Params]: z.ZodType<Params[M]> } = schemas;

const methods: { [M in keyof Params]: (params: Params[M], body: any) => Promise<unknown> } = {
  lookup_domains: (params, body) => lookupDomains(params, body.network),
  get_owner: (params, body) => getOwner(params, body.network),
  lookup_addresses: params => lookupAddresses(params),
  resolve_names: params => resolveNames(params)
};
const methodSchema = z.object(schemas).keyof();

function failImage(res: express.Response, err: unknown) {
  capture(err);
  if (res.headersSent) return res.destroy();
  ['Content-Type', 'Cache-Control', 'Expires'].forEach(name => res.removeHeader(name));
  res.status(500).json({ status: 'error', error: 'failed to load image' });
}

async function dispatch<M extends keyof typeof methods>(
  method: M,
  body: any,
  res: express.Response,
  id: unknown
) {
  const parsedParams = paramSchemas[method].safeParse(body.params);
  if (!parsedParams.success) return rpcInvalidParams(res, formatZodError(parsedParams.error), id);
  return rpcSuccess(res, await methods[method](parsedParams.data, body), id);
}

router.post('/', async (req, res) => {
  const { id = null, method } = req.body;
  try {
    const parsedMethod = methodSchema.safeParse(method);
    if (!parsedMethod.success) return rpcError(res, 400, 'invalid method', id);
    return await dispatch(parsedMethod.data, req.body, res, id);
  } catch (err) {
    const error = err as any;
    if (error?.code !== 400 && !isSilencedError(error) && !isTransportFailure(error)) {
      capture(error);
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
      const { fb, cb, fit } = req.query;
      result = await clearImageCache(type, parseQuery(id, type, { fb, cb, fit }));
    }
    res.status(result ? 200 : 404).json({ status: result ? 'ok' : 'not found' });
  } catch (err) {
    capture(err);
    res.status(500).json({ status: 'error', error: 'failed to clear cache' });
  }
});

async function serveImage(req: express.Request, res: express.Response) {
  const { type, id } = req.params as { type: ResolverType; id: string };
  const query = parseQuery(id, type, req.query);
  const {
    address,
    network,
    networkId,
    w,
    h,
    fallback,
    resolver,
    resolvers: currentResolvers,
    fit
  } = query;

  const image = await cache(
    type,
    query,
    async () => {
      const files = await Promise.all(
        currentResolvers.map(r => resolvers[r](address, network, networkId))
      );
      return files.find(Boolean) ?? false;
    },
    !!resolver
  );

  if (!image) {
    const fallbackImage = await resolvers[fallback](address, network, networkId);
    const resizedImage = await resize(fallbackImage, w, h, { fit });

    setHeader(res, 'SHORT_CACHE');
    return res.send(resizedImage);
  }

  setHeader(res);
  if (Buffer.isBuffer(image)) return res.send(image);

  image.on('error', err => failImage(res, err));
  image.pipe(res);
}

router.get(`/:type(${TYPE_CONSTRAINTS})/:id`, (req, res) =>
  serveImage(req, res).catch(err => {
    if (err instanceof z.ZodError && err.issues.every(issue => issue.path[0] === 'resolver')) {
      return res.status(400).json({ status: 'error', error: err.issues[0].message });
    }
    failImage(res, err);
  })
);

export default router;
