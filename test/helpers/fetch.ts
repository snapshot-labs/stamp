export function mockGlobalFetch(): jest.Mock {
  const originalFetch = global.fetch;
  const mockedFetch = jest.fn();

  global.fetch = mockedFetch as unknown as typeof global.fetch;
  afterAll(() => {
    global.fetch = originalFetch;
  });

  return mockedFetch;
}

// fetch stamps the url it answered from onto every response it returns, and the
// image reader names that host in its errors. A hand-built response carries
// none, so one that stands in for a fetched image has to be given it here.
export function answeredFrom(url: string, response: Response): Response {
  Object.defineProperty(response, 'url', { value: url });

  return response;
}

export function jsonResponse(body: any, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Upstream Error',
    headers: { 'Content-Type': 'application/json' }
  });
}

export function incompleteJsonResponse(prefix: string, signal?: AbortSignal | null) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(prefix));
        signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
