import { capture } from '@snapshot-labs/snapshot-sentry';
import request from 'supertest';
import { httpError } from '../../src/helpers/errors';
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

function lookupDomains() {
  return request(app).post('/').send({ method: 'lookup_domains', params: ADDRESS, network: '1' });
}

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

  describe('on get_owner upstream failures', () => {
    async function getOwnerRequest() {
      return request(app).post('/').send({ method: 'get_owner', params: 'test.shib' });
    }

    it('does not capture connection timeouts', async () => {
      (getOwner as jest.Mock).mockRejectedValue(
        Object.assign(new TypeError('fetch failed'), {
          cause: { code: 'UND_ERR_CONNECT_TIMEOUT' }
        })
      );

      expect((await getOwnerRequest()).status).toBe(500);
      expect(capture).not.toHaveBeenCalled();
    });

    it('does not capture D3 5xx responses', async () => {
      (getOwner as jest.Mock).mockRejectedValue(httpError('d3', 503, ''));

      expect((await getOwnerRequest()).status).toBe(500);
      expect(capture).not.toHaveBeenCalled();
    });

    it('captures D3 authorization failures with their status', async () => {
      (getOwner as jest.Mock).mockRejectedValue(httpError('d3', 403, ''));

      expect((await getOwnerRequest()).status).toBe(500);
      expect(capture).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    it('does not capture invalid input', async () => {
      const response = await request(app)
        .post('/')
        .send({ method: 'get_owner', params: { invalid: true } });

      expect(response.status).toBe(400);
      expect(capture).not.toHaveBeenCalled();
    });
  });
});
