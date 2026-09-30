import { AsyncLocalStorage } from 'async_hooks';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as graphql from '../../src/helpers/graphql';
import * as resolver from '../../src/helpers/resolver';

const attemptFailures = new AsyncLocalStorage<unknown[]>();

function record(err: unknown): void {
  attemptFailures.getStore()?.push(err);
}

export function recordResolverFailures() {
  const { callResolver } = resolver;
  const { graphQlCall } = graphql;
  const { fetch } = global;
  const { send } = JsonRpcProvider.prototype;

  jest.spyOn(resolver, 'callResolver').mockImplementation((fn, options) =>
    callResolver(async () => {
      try {
        return await fn();
      } catch (err) {
        if (!options.isRoutineMiss?.(err)) record(err);
        throw err;
      }
    }, options)
  );
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    try {
      const response = await fetch(input, init);
      if (!response.ok && response.status !== 404) {
        record(new Error(`HTTP ${response.status} from ${response.url}`));
      }
      return response;
    } catch (err) {
      record(err);
      throw err;
    }
  });
  jest.spyOn(graphql, 'graphQlCall').mockImplementation(async (...args) => {
    try {
      return await graphQlCall(...args);
    } catch (err) {
      record(err);
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
        record(err);
      }
      throw err;
    }
  });
  // One list per call of the test function, i.e. per attempt: shared by the test instead, a
  // timed-out attempt's late failures and follow-up calls would land in its retry's list.
  return (test: (failures: unknown[]) => Promise<void>) => () => {
    const failures: unknown[] = [];
    return attemptFailures.run(failures, () => test(failures));
  };
}
