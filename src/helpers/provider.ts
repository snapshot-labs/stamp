import snapshot from '@snapshot-labs/snapshot.js';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function provider(
  network: string,
  providerOptions: { broviderUrl?: string; timeout?: number } = { broviderUrl, timeout: 5e3 }
) {
  return snapshot.utils.getProvider(network, providerOptions);
}
