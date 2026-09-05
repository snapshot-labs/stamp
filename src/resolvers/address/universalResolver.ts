import {
  BaseError,
  ccipRequest,
  CcipRequestParameters,
  ContractFunctionRevertedError,
  createPublicClient,
  http,
  Address as ViemAddress
} from 'viem';
import { mainnet } from 'viem/chains';
import { withDeadline } from '../../helpers/deadline';
import { getProviderOptions } from '../../helpers/provider';

const rpcUrl = `${getProviderOptions().broviderUrl}/${mainnet.id}`;
const EMPTY_REVERSE_ERRORS = new Set([
  'ResolverNotContract',
  'ResolverNotFound',
  'ReverseAddressMismatch',
  'UnsupportedResolverProfile'
]);
const TRANSIENT_GATEWAY_ERRORS = new Set(['This operation was aborted', 'HTTP request failed.']);

function getRevertedError(error: unknown): ContractFunctionRevertedError | undefined {
  if (!(error instanceof BaseError)) return;

  const reverted = error.walk(cause => cause instanceof ContractFunctionRevertedError);
  return reverted instanceof ContractFunctionRevertedError ? reverted : undefined;
}

function isEmptyReverseError(error: unknown): boolean {
  return EMPTY_REVERSE_ERRORS.has(getRevertedError(error)?.data?.errorName || '');
}

export function isSilencedReverseError(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  if (!error.walk(cause => cause instanceof Error && cause.name === 'OffchainLookupError')) {
    return false;
  }

  const data = getRevertedError(error)?.data;
  if (data?.errorName === 'HttpError') {
    const status = data.args?.[0];
    return typeof status === 'number' && (status === 429 || status >= 500);
  }

  return (
    data?.errorName === 'Error' &&
    typeof data.args?.[0] === 'string' &&
    TRANSIENT_GATEWAY_ERRORS.has(data.args[0])
  );
}
const client = createPublicClient({
  chain: mainnet,
  batch: { multicall: { batchSize: 16 * 1024 } },
  transport: http(rpcUrl, { retryCount: 0, timeout: 5e3 }),
  ccipRead: {
    request: (parameters: CcipRequestParameters) =>
      withDeadline(signal =>
        ccipRequest({
          ...parameters,
          requestOptions: {
            ...parameters.requestOptions,
            signal: parameters.requestOptions?.signal
              ? AbortSignal.any([parameters.requestOptions.signal, signal])
              : signal
          }
        })
      )
  }
});

export type BatchError = { address: string; error: unknown };
export type BatchResult = { values: Record<string, string>; errors: BatchError[] };

export async function reverseLookup(addresses: string[]): Promise<BatchResult> {
  const settled = await Promise.allSettled(
    addresses.map(address => client.getEnsName({ address: address as ViemAddress, strict: true }))
  );
  const values: Record<string, string> = {};
  const errors: BatchError[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) values[addresses[index]] = result.value;
    } else if (!isEmptyReverseError(result.reason)) {
      errors.push({ address: addresses[index], error: result.reason });
    }
  });

  return { values, errors };
}
