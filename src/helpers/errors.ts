// Both locations are load-bearing: isSilencedError reads `status` and
// `response.status`, and a status only in the message string is unreachable to it.
export function httpError(source: string, status: number, message: string) {
  return Object.assign(new Error(`[${source}] ${message}`), {
    status,
    response: { status }
  });
}

function getErrorNodes(error: any): any[] {
  const nodes: any[] = [];
  const pending = [error];
  const seen = new Set();

  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || (typeof node !== 'object' && typeof node !== 'function') || seen.has(node)) {
      continue;
    }

    seen.add(node);
    nodes.push(node);
    pending.push(node.error, node.cause);
  }

  return nodes;
}

export function isSilencedError(error: any, additionalMessages?: string[]): boolean {
  // A rejection carries whatever it was given, null included. There is nothing
  // in one to classify, and reporting it is not an option either: `capture`
  // dereferences it and throws, from inside the catch block that called this.
  if (!error) return true;

  // ethers v5 re-labels a non-JSON response from an RPC as CALL_EXCEPTION.
  // The nested HTTP status is the reliable signal that this was an upstream
  // endpoint outage rather than a contract revert.
  const upstreamStatus = Number(error.error?.status);
  if (upstreamStatus >= 500 && upstreamStatus < 600) return true;

  const nodes = getErrorNodes(error);
  const statuses = nodes.flatMap(node => [node.status, node.response?.status]);

  if (statuses.some(status => status === 401 || status === 403)) return false;

  // An abort is always one of our own deadlines, and each transport words it differently.
  if (nodes.some(node => node.name === 'AbortError')) return true;

  const messages = [
    'invalid token ID',
    'is not supported',
    'execution reverted',
    'status=504',
    // SERVFAIL (2) is a transient external-resolver failure. Other statuses stay
    // visible as they may signal a real problem (e.g. FORMERR 1 = malformed query);
    // NXDOMAIN (3) never reaches here (dns-connect returns it as an empty result).
    'Received error status from DNS server: 2.',
    'The request took too long to respond.',
    'This operation was aborted',
    'bad port',
    ...(additionalMessages || [])
  ];
  const codes = nodes.flatMap(node => [node.code, node.status, node.response?.status, node.name]);
  return (
    messages.some(m =>
      nodes.some(node => node.message?.includes(m) || node.details?.includes(m))
    ) ||
    [
      'TIMEOUT',
      'TimeoutError',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'UND_ERR_SOCKET',
      504,
      429
    ].some(c => codes.some(v => String(v ?? '').includes(String(c))))
  );
}

const TRANSPORT_FAILURE_CODES = [
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT'
];

export function isTransportFailure(error: any): boolean {
  return TRANSPORT_FAILURE_CODES.includes(error?.cause?.code ?? error?.code);
}
