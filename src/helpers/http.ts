import dns from 'dns';
import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import ipaddr from 'ipaddr.js';
import { Agent, buildConnector, Dispatcher, fetch, Response } from 'undici';
import { isStarknetAddress } from './address';
import { withDeadline } from './deadline';
import { httpError } from './errors';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

class BlockedAddressError extends Error {}

export function isPublicAddress(rawAddress: string): boolean {
  const address = ipaddr.parse(rawAddress);

  if (address.kind() === 'ipv6') {
    const ipv6 = address as ipaddr.IPv6;
    const routable = ipv6.isIPv4MappedAddress() ? ipv6.toIPv4Address() : ipv6;

    return routable.range() === 'unicast';
  }

  return address.range() === 'unicast';
}

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
): void {
  dns.lookup(hostname, options as dns.LookupAllOptions, (err, address, family) => {
    if (err) return callback(err, address, family);

    const resolved: dns.LookupAddress[] = Array.isArray(address) ? address : [{ address, family }];
    const blocked = resolved.find(({ address: ip }) => !isPublicAddress(ip));

    if (blocked) {
      return callback(
        new BlockedAddressError(`resolved to a blocked address: ${blocked.address}`),
        address,
        family
      );
    }

    callback(null, address, family);
  });
}

const connect = buildConnector({ lookup: safeLookup as unknown as (typeof dns)['lookup'] });

function guardedConnect(options: buildConnector.Options, callback: buildConnector.Callback): void {
  if (ipaddr.isValid(options.hostname) && !isPublicAddress(options.hostname)) {
    callback(new BlockedAddressError(`blocked address: ${options.hostname}`), null);
    return;
  }

  connect(options, callback);
}

const safeDispatcher: Dispatcher = new Agent({ connect: guardedConnect });

function assertAllowedUrl(url: string): void {
  const parsed = new URL(url);

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw httpError(parsed.host, 400, `unsupported scheme: ${parsed.protocol}`);
  }
}

// Spaces are keyed by address on the onchain APIs, and both accept the raw id
// as well as the checksummed one. An id that is not an address is not a space
// there, so it is no-data rather than something to ask about.
export function spaceIds(id: string): string[] | null {
  if (isStarknetAddress(id)) return [id];

  try {
    return [id, getAddress(id)];
  } catch {
    return null;
  }
}

export function fetchWithDeadline<T>(
  url: string,
  read: (response: Response) => Promise<T>,
  dispatcher: Dispatcher = safeDispatcher
): Promise<T> {
  return withDeadline(async signal => {
    if (dispatcher === safeDispatcher) assertAllowedUrl(url);

    const response = await fetch(url, { signal, dispatcher }).catch(err => {
      if (err.cause instanceof BlockedAddressError)
        throw httpError(new URL(url).host, 400, err.cause.message);

      throw err;
    });

    if (!response.ok) throw httpError(new URL(url).host, response.status, response.statusText);

    return read(response);
  }, 5e3);
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function readBoundedImage(url: string, response: Response): Promise<Buffer> {
  const host = new URL(url).host;
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw httpError(host, 404, `image too large: ${declared} bytes`);
  }

  if (!response.body) return Buffer.from(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) {
      throw httpError(host, 404, `image too large: over ${MAX_IMAGE_BYTES} bytes`);
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export function fetchHttpImage(url: string, dispatcher?: Dispatcher): Promise<Buffer> {
  return fetchWithDeadline(url, response => readBoundedImage(url, response), dispatcher);
}

export function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
}

export function getUrl(url: string): string | null {
  const gateway: string = process.env.IPFS_GATEWAY || 'cloudflare-ipfs.com';
  const candidate = snapshot.utils.getUrl(url, gateway);
  if (!candidate) return null;

  return isHttpUrl(candidate) ? candidate : null;
}
