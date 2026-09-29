import * as resolver from '../../src/helpers/resolver';

// callResolver answers empty on any provider error, so a test expecting an
// empty answer passes through an outage too. This records every error it
// swallows, except the ones the caller declared a routine miss.
export function recordResolverFailures(): unknown[] {
  const failures: unknown[] = [];
  const { callResolver } = resolver;

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
  beforeEach(() => {
    failures.length = 0;
  });

  return failures;
}
