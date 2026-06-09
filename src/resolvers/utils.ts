import http from 'http';
import https from 'https';
import fetch, { RequestInit, Response } from 'node-fetch';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

export const DEFAULT_TIMEOUT = 5e3;

// Selects the keep-alive agent matching the request protocol, mirroring the
// previous axios httpAgent/httpsAgent setup.
export const fetchAgent = (parsedUrl: URL) =>
  parsedUrl.protocol === 'http:' ? httpAgent : httpsAgent;

export const defaultFetchParams: RequestInit = {
  agent: fetchAgent,
  timeout: DEFAULT_TIMEOUT
};

export async function fetchWithKeepAlive(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...defaultFetchParams, ...init });
}

export async function fetchHttpImage(url: string): Promise<Buffer> {
  const response = await fetchWithKeepAlive(url);
  return response.buffer();
}
