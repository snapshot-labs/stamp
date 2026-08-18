import { createPublicClient, http, Address as ViemAddress } from 'viem';
import { mainnet } from 'viem/chains';

const rpcUrl = `${process.env.BROVIDER_URL || 'https://rpc.snapshot.org'}/1`;
const client = createPublicClient({
  chain: mainnet,
  batch: { multicall: { batchSize: 64 * 1024, wait: 0 } },
  transport: http(rpcUrl, { retryCount: 0, timeout: 5e3 })
});

export type BatchResult = { values: Record<string, string>; errors: unknown[] };

export async function reverseLookup(addresses: string[]): Promise<BatchResult> {
  const settled = await Promise.allSettled(
    addresses.map(address => client.getEnsName({ address: address as ViemAddress }))
  );
  const values: Record<string, string> = {};
  const errors: unknown[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) values[addresses[index]] = result.value;
    } else {
      errors.push(result.reason);
    }
  });

  return { values, errors };
}
