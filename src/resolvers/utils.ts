import { DEFAULT_TIMEOUT } from '../utils';

export { DEFAULT_TIMEOUT };

export async function fetchHttpImage(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) });

  if (!response.ok) {
    throw new Error(`Failed to fetch image at ${url}: status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
