export const DEFAULT_TIMEOUT = 5e3;

// Native fetch (undici) reuses connections via keep-alive by default, so the
// previous http/https keep-alive agents are no longer needed.
export async function fetchWithKeepAlive(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    ...init
  });
}

export async function fetchHttpImage(url: string): Promise<Buffer> {
  const response = await fetchWithKeepAlive(url);
  return Buffer.from(await response.arrayBuffer());
}
