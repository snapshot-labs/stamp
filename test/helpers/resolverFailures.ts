import { JsonRpcProvider } from '@ethersproject/providers';
import * as graphql from '../../src/helpers/graphql';
import * as resolver from '../../src/helpers/resolver';

type Attempt = { invocations: number; failures: unknown[] };

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

// Each spy takes its attempt's list when the call starts, not when it fails: an attempt
// that timed out can still fail afterwards, and must not blame the retry.
export function recordResolverFailures(): () => unknown[] {
  const { callResolver } = resolver;
  const { graphQlCall } = graphql;
  const { fetch } = global;
  const { send } = JsonRpcProvider.prototype;

  jest.spyOn(resolver, 'callResolver').mockImplementation((fn, options) => {
    const failures = attemptFailures();
    return callResolver(async () => {
      try {
        return await fn();
      } catch (err) {
        if (!options.isRoutineMiss?.(err)) failures?.push(err);
        throw err;
      }
    }, options);
  });
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const failures = attemptFailures();
    try {
      const response = await fetch(input, init);
      if (!response.ok && response.status !== 404) {
        failures?.push(new Error(`HTTP ${response.status} from ${response.url}`));
      }
      return response;
    } catch (err) {
      failures?.push(err);
      throw err;
    }
  });
  jest.spyOn(graphql, 'graphQlCall').mockImplementation(async (...args) => {
    const failures = attemptFailures();
    try {
      return await graphQlCall(...args);
    } catch (err) {
      failures?.push(err);
      throw err;
    }
  });
  jest.spyOn(JsonRpcProvider.prototype, 'send').mockImplementation(async function (
    this: JsonRpcProvider,
    method,
    params
  ) {
    const failures = attemptFailures();
    try {
      return await send.call(this, method, params);
    } catch (err) {
      if (
        !/^execution reverted/.test((err as { error?: { message?: string } }).error?.message ?? '')
      ) {
        failures?.push(err);
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
