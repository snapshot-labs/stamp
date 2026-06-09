import { isSilencedError } from '../../src/addressResolvers/utils';
import { graphQlCall } from '../../src/utils';

// Deterministic unit coverage for the axios -> native fetch migration in
// graphQlCall (PR #457). Mocks global.fetch so no network is required, unlike
// the live integration/e2e suites. Covers: the AbortSignal.timeout wiring, the
// preserved axios-style `{ data: <body> }` response shape, and the non-2xx
// FetchError whose `response.status` keeps isSilencedError's 504 silencing
// working after the wrapper removal.
describe('graphQlCall (native fetch)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(impl: jest.Mock) {
    global.fetch = impl as unknown as typeof fetch;
    return impl;
  }

  it('preserves the axios { data: <body> } response shape on success', async () => {
    const payload = { data: { foo: 'bar' } };
    mockFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload
      })
    );

    const result = await graphQlCall('https://example.com/graphql', 'query { foo }');

    // Callers destructure `{ data: { data } }`; the outer `data` is the wrapper,
    // the inner `data` is the GraphQL body.
    expect(result).toEqual({ data: payload });
    expect(result.data.data).toEqual({ foo: 'bar' });
  });

  it('passes an AbortSignal (timeout) and JSON body/headers to fetch', async () => {
    const fetchMock = mockFetch(
      jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    );

    await graphQlCall('https://example.com/graphql', 'query { foo }', { a: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/graphql');
    expect(init.method).toBe('post');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ query: 'query { foo }', variables: { a: 1 } });
  });

  it('omits null/undefined option headers', async () => {
    const fetchMock = mockFetch(
      jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    );

    await graphQlCall('https://example.com/graphql', 'query { foo }', undefined, {
      headers: { 'x-keep': 'yes', 'x-drop': undefined, 'x-null': null }
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['x-keep']).toBe('yes');
    expect('x-drop' in init.headers).toBe(false);
    expect('x-null' in init.headers).toBe(false);
  });

  it('throws on non-2xx, and the error is silenced by isSilencedError for 504', async () => {
    mockFetch(
      jest.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => ({})
      })
    );

    let thrown: any;
    try {
      await graphQlCall('https://example.com/graphql', 'query { foo }');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    // Wrapper-removal guarantee: the FetchError carries response.status so the
    // existing 504 silencing keeps working (replacing axios' error.response.status).
    expect(thrown.response.status).toBe(504);
    expect(isSilencedError(thrown)).toBe(true);
  });

  it('does not silence a non-504 failure (e.g. 500)', async () => {
    mockFetch(
      jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({})
      })
    );

    let thrown: any;
    try {
      await graphQlCall('https://example.com/graphql', 'query { foo }');
    } catch (err) {
      thrown = err;
    }

    expect(thrown.response.status).toBe(500);
    expect(isSilencedError(thrown)).toBe(false);
  });
});
