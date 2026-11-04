import { capture } from '@snapshot-labs/snapshot-sentry';
import { isSilencedError, isTransportFailure } from './errors';
import { Handle } from './types';
import { EXCLUSIVE_TLDS as gweiTlds } from '../resolvers/address/gwei';
import { EXCLUSIVE_TLDS as lensTlds } from '../resolvers/address/lens';
import { EXCLUSIVE_TLDS as shibariumTlds } from '../resolvers/address/shibarium';
import { EXCLUSIVE_TLDS as spaceIdTlds } from '../resolvers/address/spaceId';
import { EXCLUSIVE_TLDS as starknetTlds } from '../resolvers/address/starknet';

const OWNED_TLDS = [gweiTlds, lensTlds, shibariumTlds, spaceIdTlds, starknetTlds].flat();

export function hasOwnedTld(handle: Handle): boolean {
  const normalizedHandle = handle.toLowerCase();
  return OWNED_TLDS.some(tld => normalizedHandle.endsWith(tld));
}

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
