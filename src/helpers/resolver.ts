import { capture } from '@snapshot-labs/snapshot-sentry';
import { isSilencedError, isTransportFailure } from './errors';

type CallOptions<T> = {
  provider: string;
  input: Record<string, unknown>;
  empty: T;
  isRoutineMiss?: (error: unknown) => boolean;
  endTimer?: (labels: { status: number }) => void;
};

export async function callResolver<T>(
  fn: () => Promise<T>,
  { provider, input, empty, isRoutineMiss, endTimer }: CallOptions<T>
): Promise<T> {
  let status = 0;

  try {
    const result = await fn();
    status = 1;
    return result;
  } catch (err) {
    if (!isSilencedError(err) && !isTransportFailure(err) && !isRoutineMiss?.(err)) {
      // A top-level `input` beside `tags` is dropped rather than wrapped.
      capture(err, { tags: { provider }, contexts: { input } });
    }
    return empty;
  } finally {
    endTimer?.({ status });
  }
}
