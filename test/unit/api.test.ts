import { Readable } from 'stream';
import { capture } from '@snapshot-labs/snapshot-sentry';
import sharp from 'sharp';
import request from 'supertest';
import { clear, get } from '../../src/aws';
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
  get: jest.fn(),
  clear: jest.fn()
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

describe('GET /avatar/:id?resolver=', () => {
  let spies: [string, jest.SpyInstance][];

  beforeEach(() => {
    spies = (Object.keys(resolvers) as (keyof typeof resolvers)[])
      .filter(name => name !== 'blockie')
      .map(name => [name, jest.spyOn(resolvers, name).mockResolvedValue(false)]);
  });

  afterEach(() => spies.forEach(([, spy]) => spy.mockRestore()));

  function expectInvalidResolver(response: request.Response) {
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ status: 'error', error: 'invalid resolvers' });
  }

  it('returns a 400 for an unknown resolver on a cold cache', async () => {
    expectInvalidResolver(await request(app).get(`/avatar/${ADDRESS}?resolver=garbage`));
  });

  it('returns a 400 for an unknown resolver when the base image is cached', async () => {
    const image = await sharp({
      create: { width: 1, height: 1, channels: 4, background: '#000' }
    })
      .png()
      .toBuffer();
    (get as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(Readable.from([image]));

    expectInvalidResolver(await request(app).get(`/avatar/${ADDRESS}?resolver=garbage`));
  });

  it('returns a 400 when the resolver is given more than once', async () => {
    const [a, b] = constants.resolvers.avatar;

    expectInvalidResolver(await request(app).get(`/avatar/${ADDRESS}?resolver=${a}&resolver=${b}`));
  });

  it('runs only the requested resolver', async () => {
    const resolver = constants.resolvers.avatar[1];
    const response = await request(app).get(`/avatar/${ADDRESS}?resolver=${resolver}`);

    expect(response.status).toBe(200);
    expect(spies.filter(([, spy]) => spy.mock.calls.length).map(([name]) => name)).toEqual([
      resolver
    ]);
  });
});

describe.each([
  ...Object.entries(constants.resolvers),
  ['address', constants.resolvers.avatar],
  ['name', constants.resolvers.avatar]
])('GET /%s/:id', (type, expected) => {
  let spies: [string, jest.SpyInstance][];

  beforeEach(() => {
    spies = (Object.keys(resolvers) as (keyof typeof resolvers)[])
      .filter(name => name !== 'blockie')
      .map(name => [name, jest.spyOn(resolvers, name).mockResolvedValue(false)]);
  });

  afterEach(() => spies.forEach(([, spy]) => spy.mockRestore()));

  it('uses its configured resolvers', async () => {
    const response = await request(app).get(`/${type}/${ADDRESS}`);

    expect(response.status).toBe(200);
    expect(
      spies
        .filter(([, spy]) => spy.mock.calls.length)
        .map(([name]) => name)
        .sort()
    ).toEqual([...expected].sort());
  });
});

describe('GET /clear/:type/:id', () => {
  it.each([
    ['a plain id', ADDRESS, ''],
    ['a network:address id', `oeth:${ADDRESS}`, ''],
    ['non-default fb/cb/fit', ADDRESS, '&fb=jazzicon&cb=42&fit=contain']
  ])('clears the base key the image route writes, for %s', async (_, id, query) => {
    (get as jest.Mock).mockResolvedValueOnce(Readable.from([Buffer.from('cached')]));
    await request(app).get(`/avatar/${id}?s=65${query}`);
    const baseKey = (get as jest.Mock).mock.calls[0][0].split('/')[0];

    (clear as jest.Mock).mockResolvedValueOnce(true);
    const response = await request(app).get(`/clear/avatar/${id}?s=65${query}`);

    expect(response.status).toBe(200);
    expect(clear).toHaveBeenLastCalledWith(baseKey);
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
  describe('when the method is not a known method name', () => {
    it.each([
      ['an Object.prototype key', { method: 'toString' }],
      ['an array-wrapped method name', { method: ['lookup_domains'] }],
      ['missing', {}]
    ])('returns invalid method when it is %s', async (_, body) => {
      const response = await request(app)
        .post('/')
        .send({ id: 1, params: ADDRESS, ...body });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        error: { code: 400, message: 'unauthorized', data: 'invalid method' },
        id: 1
      });
      expect(capture).not.toHaveBeenCalled();
    });
  });

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
