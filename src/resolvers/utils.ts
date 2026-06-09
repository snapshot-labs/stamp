export const DEFAULT_TIMEOUT = 5e3;

export async function fetchHttpImage(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) });
  return Buffer.from(await response.arrayBuffer());
}
