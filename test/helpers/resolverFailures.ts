import { JsonRpcProvider } from '@ethersproject/providers';
import * as graphql from '../../src/helpers/graphql';
import * as resolver from '../../src/helpers/resolver';

type Attempt = { invocations: number; failures: unknown[] };

// Not one array reset in beforeEach: *Each hooks never run for it.concurrent tests, so
// concurrent peers and earlier retry attempts would leak into each other's failures.
const attempts = new WeakMap<object, Attempt>();

function attemptFailures(): unknown[] | undefined {
  const test = expect.getState().currentTestIdentity?.() as { invocations: number } | undefined;
  if (!test) return undefined;

  let attempt = attempts.get(test);
  if (attempt?.invocations !== test.invocations) {
    attempt = { invocations: test.invocations, failures: [] };
    attempts.set(test, attempt);
  }
  return attempt.failures;
}

function record(err: unknown): void {
  attemptFailures()?.push(err);
}

export function recordResolverFailures(): () => unknown[] {
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
  return () => {
    const failures = attemptFailures();
    if (!failures) throw new Error('resolver failures are only tracked inside a test');
    return failures;
  };
}
