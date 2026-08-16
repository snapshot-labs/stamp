import { StaticJsonRpcProvider } from '@ethersproject/providers';
import snapshot from '@snapshot-labs/snapshot.js';
import { Address } from './types';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';
const providers: Record<string, StaticJsonRpcProvider> = {};

export function provider(
  network: string,
  providerOptions: { broviderUrl?: string; timeout?: number } = { broviderUrl, timeout: 5e3 }
) {
  return snapshot.utils.getProvider(network, providerOptions);
}

export function getProvider(network: number): StaticJsonRpcProvider {
  if (!providers[`_${network}`])
    providers[`_${network}`] = new StaticJsonRpcProvider(
      { url: `https://rpc.snapshot.org/${network}`, timeout: 20e3, allowGzip: true },
      network
    );
  return providers[`_${network}`];
}

export async function batchContractCalls(
  network: string,
  rpcProvider: StaticJsonRpcProvider,
  abi: string[],
  args: any[],
  addresses: Address[],
  fnName: string
) {
  const multicall = new snapshot.utils.Multicaller(network, rpcProvider, abi);
  args.forEach((arg, i) => multicall.call(`${fnName}.${arg}`, addresses[i], fnName, [arg]));
  return (await multicall.execute())[fnName];
}
