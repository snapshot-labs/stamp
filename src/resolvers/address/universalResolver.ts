import {
  ccipRequest,
  CcipRequestParameters,
  createPublicClient,
  http,
  Address as ViemAddress
} from 'viem';
import { mainnet } from 'viem/chains';
import { withDeadline } from '../../helpers/deadline';
import { getProviderOptions } from '../../helpers/provider';

const rpcUrl = `${getProviderOptions().broviderUrl}/${mainnet.id}`;
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
    addresses.map(address => client.getEnsName({ address: address as ViemAddress }))
  );
  const values: Record<string, string> = {};
  const errors: BatchError[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) values[addresses[index]] = result.value;
    } else {
      errors.push({ address: addresses[index], error: result.reason });
    }
  });

  return { values, errors };
}
