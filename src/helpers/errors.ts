// Both locations are load-bearing: isSilencedError reads `status` and
// `response.status`, and a status only in the message string is unreachable to it.
export function httpError(source: string, status: number, message: string) {
  return Object.assign(new Error(`[${source}] ${message}`), {
    status,
    response: { status }
  });
}

export function isSilencedError(error: any, additionalMessages?: string[]): boolean {
  // A rejection carries whatever it was given, null included. There is nothing
  // in one to classify, and reporting it is not an option either: `capture`
  // dereferences it and throws, from inside the catch block that called this.
  if (!error) return true;

  // An abort is always one of our own deadlines, and each transport words it differently.
  if (error.name === 'AbortError') return true;

  const messages = [
    'invalid token ID',
    'is not supported',
    'execution reverted',
    'status=504',
    // SERVFAIL (2) is a transient external-resolver failure. Other statuses stay
    // visible as they may signal a real problem (e.g. FORMERR 1 = malformed query);
    // NXDOMAIN (3) never reaches here (dns-connect returns it as an empty result).
    'Received error status from DNS server: 2.',
    ...(additionalMessages || [])
  ];
  const codes = [
    error.error?.code,
    error.error?.status,
    error.code,
    error.status,
    error.response?.status,
    error.cause?.code
  ];
  return (
    messages.some(
      m =>
        error.message?.includes(m) ||
        error.error?.message?.includes(m) ||
        error.cause?.message?.includes(m)
    ) ||
    ['TIMEOUT', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 504, 429].some(c =>
      codes.some(v => String(v ?? '').includes(String(c)))
    )
  );
}
