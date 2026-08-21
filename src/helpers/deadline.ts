const UPSTREAM_TIMEOUT = 10000;

export const FETCH_BUDGET = 5e3;

// `isSilencedError` reads the error name, and the two ways to abort raise
// different ones: `AbortController` gives `AbortError`, `AbortSignal.timeout`
// gives `TimeoutError`.
export async function withDeadline<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  budget = UPSTREAM_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budget);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
    // Callers throw on a non-2xx before reading the body, which leaves the
    // response unconsumed and its socket stranded until GC.
    controller.abort();
  }
}

// For a callee that takes no signal of its own. This bounds the wait rather
// than the request: the work already started keeps running, capped only by
// whatever timeout its own client has.
export function untilAborted<T>(signal: AbortSignal, work: Promise<T>): Promise<T> {
  const aborted = new Promise<never>((_, reject) => {
    if (signal.aborted) return reject(signal.reason);

    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

  return Promise.race([work, aborted]);
}
