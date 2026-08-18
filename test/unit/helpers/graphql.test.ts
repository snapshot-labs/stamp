import { isSilencedError } from '../../../src/helpers/errors';
import { graphQlCall } from '../../../src/helpers/graphql';

const originalFetch = global.fetch;
const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof global.fetch;

const URL = 'https://hub.snapshot.org/graphql';
const QUERY = 'query users { users { id } }';

function respondWith(body: any, status = 200) {
  mockedFetch.mockResolvedValue(
    new Response(
      body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body),
      {
        status,
        statusText: status === 200 ? 'OK' : 'Upstream Error',
        headers: { 'Content-Type': 'application/json' }
      }
    )
  );
}

async function errorFrom(body: any, status = 200) {
  respondWith(body, status);

  try {
    await graphQlCall(URL, QUERY);
  } catch (err: any) {
    return err;
  }

  throw new Error('graphQlCall resolved, expected it to throw');
}

afterAll(() => {
  global.fetch = originalFetch;
});

describe('graphQlCall', () => {
  describe('when the envelope is intact', () => {
    it('returns the response', async () => {
      respondWith({ data: { users: [{ id: '0x1' }] } });

      const { data } = await graphQlCall(URL, QUERY);

      expect(data.data.users).toEqual([{ id: '0x1' }]);
    });

    it('does not throw on a field that resolved to null', async () => {
      respondWith({ data: { account: null } });

      const { data } = await graphQlCall(URL, QUERY);

      expect(data.data.account).toBeNull();
    });
  });

  describe('when the body carries errors', () => {
    it('throws the upstream message, attributed to the upstream', async () => {
      const err = await errorFrom({
        errors: [{ message: 'Invalid addresses in id' }],
        data: { users: null }
      });

      expect(err.message).toBe('[hub.snapshot.org] Invalid addresses in id');
    });

    it('falls back to a generic message when the upstream gives none', async () => {
      const err = await errorFrom({ errors: [{}], data: null });

      expect(err.message).toBe('[hub.snapshot.org] GraphQL request failed');
    });

    it('does not throw on an empty errors array', async () => {
      respondWith({ errors: [], data: { users: [] } });

      await expect(graphQlCall(URL, QUERY)).resolves.toBeDefined();
    });
  });

  describe('when the data envelope is absent', () => {
    it.each<[string, any]>([
      ['no data key at all', { errors: [{ message: 'boom' }] }],
      ['a null data envelope', { data: null }],
      ['an empty body', {}]
    ])('throws on %s', async (_, body) => {
      const err = await errorFrom(body);

      expect(err.message).toMatch(/^\[hub\.snapshot\.org\] /);
    });

    it.each([
      ['an empty 204 response', undefined, 204],
      ['a malformed 200 response', 'Bad Gateway', 200]
    ])('attributes %s to its upstream', async (_, body, status) => {
      const err = await errorFrom(body, status);

      expect(err).toMatchObject({
        message: '[hub.snapshot.org] GraphQL response has no data envelope',
        status,
        response: { status }
      });
    });

    it('names the failure when there is no upstream message to quote', async () => {
      const err = await errorFrom({});

      expect(err.message).toBe('[hub.snapshot.org] GraphQL response has no data envelope');
    });

    it('names the upstream by host, not by caller', async () => {
      respondWith({});

      await expect(
        graphQlCall('https://subgrapher.snapshot.org/subgraph/arbitrum/abc', QUERY)
      ).rejects.toThrow('[subgrapher.snapshot.org]');
    });
  });

  describe('the thrown error', () => {
    it('carries the HTTP status and upstream body', async () => {
      const body = { errors: [{ message: 'boom' }], data: null };
      const err = await errorFrom(body, 429);

      expect(err.status).toBe(429);
      expect(err.response).toEqual({ status: 429, data: JSON.stringify(body) });
    });

    it.each([429, 504])('is silenced on a %i', async status => {
      const err = await errorFrom({ errors: [{ message: 'boom' }], data: null }, status);

      expect(isSilencedError(err)).toBe(true);
    });

    it('is not silenced on a status that is not transient', async () => {
      const err = await errorFrom({ errors: [{ message: 'boom' }], data: null }, 500);

      expect(isSilencedError(err)).toBe(false);
    });
  });
});
