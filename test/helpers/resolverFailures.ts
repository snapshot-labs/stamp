import { JsonRpcProvider } from '@ethersproject/providers';
import * as graphql from '../../src/helpers/graphql';
import * as resolver from '../../src/helpers/resolver';

export function recordResolverFailures(): unknown[] {
  const failures: unknown[] = [];
  const { callResolver } = resolver;
  const { graphQlCall } = graphql;
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
  jest.spyOn(graphql, 'graphQlCall').mockImplementation(async (...args) => {
    try {
      return await graphQlCall(...args);
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
      if (
        !/^execution reverted/.test((err as { error?: { message?: string } }).error?.message ?? '')
      ) {
        failures.push(err);
      }
      throw err;
    }
  });
  beforeEach(() => {
    failures.length = 0;
  });

  return failures;
}
