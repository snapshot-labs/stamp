import { capture } from '@snapshot-labs/snapshot-sentry';
import request from 'supertest';
import { graphQlCall } from '../../src/helpers/graphql';
import getOwner from '../../src/resolvers/getOwner';
import { createTestApp } from '../helpers/testServer';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../src/helpers/graphql', () => ({
  ...jest.requireActual('../../src/helpers/graphql'),
  graphQlCall: jest.fn()
}));

jest.mock('../../src/resolvers/getOwner', () => ({
  __esModule: true,
  default: jest.fn()
}));

const ADDRESS = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';
const app = createTestApp();
const originalFetch = global.fetch;

function lookupDomains() {
  return request(app).post('/').send({ method: 'lookup_domains', params: ADDRESS, network: '1' });
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('GET /space-cover/:id', () => {
  it('returns the fallback when the configured cover is missing', async () => {
    (graphQlCall as jest.Mock).mockResolvedValue({
      data: { data: { entry: { cover: 'https://example.com/missing.png' } } }
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response('<html>not found</html>', {
        status: 404,
        statusText: 'Not Found'
      })
    ) as unknown as typeof global.fetch;

    const response = await request(app).get(`/space-cover/${ADDRESS}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/webp/);
    expect(response.headers['cache-control']).toBe('public, max-age=3600');
    expect(response.body.length).toBeGreaterThan(0);
  });
});

describe('POST /', () => {
  describe('on lookup_domains', () => {
    describe('when a resolver fails', () => {
      it('captures the resolver error only once', async () => {
        (graphQlCall as jest.Mock).mockRejectedValue(
          new Error('Request failed with status code 500')
        );

        const response = await lookupDomains();

        expect(response.status).toBe(200);
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Request failed with status code 500' }),
          expect.anything()
        );
      });
    });

    describe('when a resolver fails with a silenced error', () => {
      it('does not capture anything', async () => {
        (graphQlCall as jest.Mock).mockRejectedValue(
          new Error('Request failed with status=504, no body')
        );

        const response = await lookupDomains();

        expect(response.status).toBe(200);
        expect(capture).not.toHaveBeenCalled();
      });
    });
  });

  describe('when an unexpected error is thrown', () => {
    it('captures it', async () => {
      (getOwner as jest.Mock).mockRejectedValue(new Error('unexpected'));

      const response = await request(app)
        .post('/')
        .send({ method: 'get_owner', params: 'test.shib' });

      expect(response.status).toBe(500);
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith(expect.objectContaining({ message: 'unexpected' }));
    });
  });
});
