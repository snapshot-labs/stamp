// Both locations are load-bearing: isSilencedError reads `status` and
// `response.status`, and a status only in the message string is unreachable to it.
export function httpError(source: string, status: number, message: string) {
  return Object.assign(new Error(`[${source}] ${message}`), {
    status,
    response: { status }
  });
}

// ethers v5 nests a transport error under `error.serverError`, viem four `cause`
// levels down, five on a CCIP-Read callback. `seen` stops on an error that is its own cause.
function wrapped(error: unknown, seen = new Set<unknown>()): ErrorLike[] {
  if (!error || typeof error !== 'object' || seen.has(error)) return [];
  seen.add(error);
  const e = asErrorLike(error);
  return [e, ...[e.cause, e.error, e.serverError, e.response].flatMap(c => wrapped(c, seen))];
}

type ErrorLike = Partial<
  Record<
    'name' | 'message' | 'code' | 'status' | 'cause' | 'error' | 'serverError' | 'response',
    unknown
  >
>;

export function asErrorLike(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? error : {};
}

function includesMessage(error: unknown, message: string): boolean {
  const e = asErrorLike(error);
  return typeof e.message === 'string' && e.message.includes(message);
}

export function isSilencedError(error: unknown): boolean {
  // A rejection carries whatever it was given, null included. There is nothing
  // in one to classify, and reporting it is not an option either: `capture`
  // dereferences it and throws, from inside the catch block that called this.
  if (!error) return true;

  // An abort is always one of our own deadlines, and each transport words it differently.
  const e = asErrorLike(error);
  if (e.name === 'AbortError') return true;

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
    'bad port'
  ];
  const codes = wrapped(error).flatMap(e => [e.code, e.status]);

  const upstream5xx = wrapped(error).some(e => {
    const status = Number(e.status);
    return status >= 500 && status < 600;
  });
  if (upstream5xx) return true;

  return (
    messages.some(m => [e, e.error, e.cause].some(x => includesMessage(x, m))) ||
    ['TIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'UND_ERR_SOCKET', 504, 429].some(c =>
      codes.some(v => String(v ?? '').includes(String(c)))
    )
  );
}

const TRANSPORT_FAILURE_CODES = [
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_TLSV1_UNRECOGNIZED_NAME',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT'
];

export function isTransportFailure(error: unknown): boolean {
  const e = asErrorLike(error);
  const code = asErrorLike(e.cause).code ?? e.code;
  return typeof code === 'string' && TRANSPORT_FAILURE_CODES.includes(code);
}
