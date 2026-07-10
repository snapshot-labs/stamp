import { createPublicClient, http, Address as ViemAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const rpcUrl = `${process.env.BROVIDER_URL || 'https://rpc.snapshot.org'}/1`;

const client = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl, { timeout: 20e3 })
});

export type BatchResult = { values: Record<string, string>; errors: unknown[] };

async function settle(
  keys: string[],
  task: (key: string) => Promise<string | null | undefined>
): Promise<BatchResult> {
  const settled = await Promise.allSettled(keys.map(task));
  const values: Record<string, string> = {};
  const errors: unknown[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) values[keys[index]] = result.value;
    } else {
      errors.push(result.reason);
    }
  });

  return { values, errors };
}

export function reverseLookup(addresses: string[]): Promise<BatchResult> {
  return settle(addresses, address => client.getEnsName({ address: address as ViemAddress }));
}

export function forwardLookup(names: string[]): Promise<BatchResult> {
  return settle(names, name => client.getEnsAddress({ name: normalize(name) }));
}

export function getTextRecord(name: string, key: string): Promise<string | null> {
  return client.getEnsText({ name: normalize(name), key });
}
