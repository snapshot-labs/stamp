import { capture } from '@snapshot-labs/snapshot-sentry';
import request from 'supertest';
import getOwner from '../../src/getOwner';
import { graphQlCall } from '../../src/utils';
import { createTestApp } from '../helpers/testServer';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../src/utils', () => ({
  ...jest.requireActual('../../src/utils'),
  graphQlCall: jest.fn()
}));

jest.mock('../../src/getOwner', () => ({
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
});
