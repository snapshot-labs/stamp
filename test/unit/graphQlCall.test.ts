import axios from 'axios';
import { isSilencedError } from '../../src/helpers/address';
import { graphQlCall } from '../../src/utils';

jest.mock('axios', () => {
  const mock: any = jest.fn();
  mock.get = jest.fn();
  mock.post = jest.fn();
  return { __esModule: true, default: mock };
});

const mockedAxios = axios as unknown as jest.Mock;

const URL = 'https://hub.snapshot.org/graphql';
const QUERY = 'query users { users { id } }';

function respondWith(body: any, status = 200) {
  mockedAxios.mockResolvedValue({ status, data: body });
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
      ['an empty body', {}],
      ['a body that is not a GraphQL response', 'Bad Gateway']
    ])('throws on %s', async (_, body) => {
      const err = await errorFrom(body);

      expect(err.message).toMatch(/^\[hub\.snapshot\.org\] /);
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
    it('carries the http status in both places isSilencedError reads', async () => {
      const err = await errorFrom({ errors: [{ message: 'boom' }], data: null }, 429);

      expect(err.status).toBe(429);
      expect(err.response.status).toBe(429);
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
