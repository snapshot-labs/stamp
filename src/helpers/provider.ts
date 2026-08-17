import { StaticJsonRpcProvider } from '@ethersproject/providers';
import snapshot from '@snapshot-labs/snapshot.js';
import { Address } from './types';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function getProvider(network: string | number) {
  return snapshot.utils.getProvider(network, { broviderUrl, timeout: 5e3 });
}

/**
 * Executes batch contract calls using multicall pattern
 * @param network - The network identifier
 * @param rpcProvider - The blockchain provider instance
 * @param abi - The contract ABI as an array of strings
 * @param args - Array of arguments to pass to the function calls
 * @param addresses - Array of contract addresses to call
 * @param fnName - The name of the function to call on each contract
 * @returns Promise that resolves to the results of all contract calls
 */
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
