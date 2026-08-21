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
