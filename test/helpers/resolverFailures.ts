import { JsonRpcProvider } from '@ethersproject/providers';
import * as resolver from '../../src/helpers/resolver';

export function recordResolverFailures(): unknown[] {
  const failures: unknown[] = [];
  const { callResolver } = resolver;
  const { fetch } = global;
  const { send } = JsonRpcProvider.prototype;

  jest.spyOn(resolver, 'callResolver').mockImplementation((fn, options) =>
    callResolver(async () => {
      try {
        return await fn();
      } catch (err) {
        if (!options.isRoutineMiss?.(err)) failures.push(err);
        throw err;
      }
    }, options)
  );
  // Resolvers also swallow upstream errors themselves, and the image reader
  // turns every non-2xx into a 404, so failures are caught on the wire too.
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    try {
      const response = await fetch(input, init);
      if (!response.ok && response.status !== 404) {
        failures.push(new Error(`HTTP ${response.status} from ${response.url}`));
      }
      return response;
    } catch (err) {
      failures.push(err);
      throw err;
    }
  });
  jest.spyOn(JsonRpcProvider.prototype, 'send').mockImplementation(async function (
    this: JsonRpcProvider,
    method,
    params
  ) {
    try {
      return await send.call(this, method, params);
    } catch (err) {
      // The node answered with a JSON-RPC error, e.g. a revert on an unknown name.
      if ((err as { reason?: string }).reason !== 'processing response error') failures.push(err);
      throw err;
    }
  });
  beforeEach(() => {
    failures.length = 0;
  });

  return failures;
}
