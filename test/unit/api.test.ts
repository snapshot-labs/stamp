import { Readable } from 'stream';
import { capture } from '@snapshot-labs/snapshot-sentry';
import request from 'supertest';
import { get } from '../../src/aws';
import constants from '../../src/constants.json';
import { httpError } from '../../src/helpers/errors';
import { graphQlCall } from '../../src/helpers/graphql';
import getOwner from '../../src/resolvers/getOwner';
import resolvers from '../../src/resolvers/image';
import { answeredFrom } from '../helpers/fetch';
import { createTestApp } from '../helpers/testServer';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

jest.mock('../../src/aws', () => ({
  ...jest.requireActual('../../src/aws'),
  get: jest.fn()
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
  (get as jest.Mock).mockReset();
});

function failingStream(chunks: Buffer[] = []) {
  return new Readable({
    read() {
      if (chunks.length) this.push(chunks.shift());
      else this.destroy(new Error('socket hang up'));
    }
  });
}

describe('GET /avatar/:id', () => {
  function getAvatar() {
    return request(app).get(`/avatar/${ADDRESS}?s=65`).timeout(5000);
  }

  function expectServerError(response: request.Response) {
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ status: 'error', error: 'failed to load image' });
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(response.headers['expires']).toBeUndefined();
    expect(capture).toHaveBeenCalledTimes(1);
  }

  it('returns a 500 when the cached base image cannot be decoded', async () => {
    (get as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(Readable.from([Buffer.from('not an image')]));

    expectServerError(await getAvatar());
  });

  it('returns a 500 when reading the cached base image fails', async () => {
    (get as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(failingStream());

    expectServerError(await getAvatar());
  });

  it('returns a 500 when reading the cached image fails before any byte is sent', async () => {
    (get as jest.Mock).mockResolvedValueOnce(failingStream());

    expectServerError(await getAvatar());
  });

  it('aborts the response when reading the cached image fails mid-stream', async () => {
    (get as jest.Mock).mockResolvedValueOnce(failingStream([Buffer.from('partial')]));

    await expect(getAvatar()).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(capture).toHaveBeenCalledTimes(1);
  });
});

describe.each(['address', 'name'])('GET /%s/:id', type => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the avatar resolvers', async () => {
    const spies = (Object.keys(resolvers) as (keyof typeof resolvers)[])
      .filter(name => name !== 'blockie')
      .map(name => [name, jest.spyOn(resolvers, name).mockResolvedValue(false)] as const);

    const response = await request(app).get(`/${type}/${ADDRESS}`);

    expect(response.status).toBe(200);
    expect(
      spies
        .filter(([, spy]) => spy.mock.calls.length)
        .map(([name]) => name)
        .sort()
    ).toEqual([...constants.resolvers.avatar].sort());
  });
});

describe('GET /space-cover/:id', () => {
  it('returns the fallback when the configured cover is missing', async () => {
    (graphQlCall as jest.Mock).mockResolvedValue({
      data: { entry: { cover: 'https://example.com/missing.png' } }
    });
    global.fetch = jest.fn().mockResolvedValue(
      answeredFrom(
        'https://example.com/missing.png',
        new Response('<html>not found</html>', {
          status: 404,
          statusText: 'Not Found'
        })
      )
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
          new Error('[hub.snapshot.org] status code 500: Internal Server Error')
        );

        const response = await lookupDomains();

        expect(response.status).toBe(200);
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture).toHaveBeenCalledWith(
          expect.objectContaining({
            message: '[hub.snapshot.org] status code 500: Internal Server Error'
          }),
          expect.anything()
        );
      });
    });

    describe('when a resolver fails with a silenced error', () => {
      it('does not capture anything', async () => {
        (graphQlCall as jest.Mock).mockRejectedValue(
          Object.assign(new Error('[hub.snapshot.org] status code 504: Gateway Timeout'), {
            status: 504,
            response: { status: 504 }
          })
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

    it('does not capture a D3 host that no longer resolves', async () => {
      (getOwner as jest.Mock).mockRejectedValue(
        Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
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

    it('does not throw when the rejection itself is null', async () => {
      (getOwner as jest.Mock).mockRejectedValue(null);

      expect((await getOwnerRequest()).status).toBe(500);
      expect(capture).not.toHaveBeenCalled();
    });
  });
});
