import request from 'supertest';
import { KEY_PREFIX } from '../../src/addressResolvers/cache';
import redis from '../../src/helpers/redis';
import { createTestApp } from '../helpers/testServer';

const app = createTestApp();
let server: any;

async function purge(): Promise<void> {
  if (!redis) return;

  const keys = await redis.keys(`${KEY_PREFIX}:*`);
  const transaction = redis.multi();

  keys.map((key: string) => transaction.del(key));
  transaction.exec();
}

describe('E2E api', () => {
  beforeAll(async () => {
    server = app.listen(0); // Use port 0 to get a random available port
  });

  afterAll(async () => {
    if (server) {
      // Force close all connections if available
      if (server.closeAllConnections) {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      server = null;
    }
  });
  describe('GET type/TYPE/ID', () => {
    it.todo('returns a 500 status on invalid query');

    describe('when the image is not cached', () => {
      it.todo('returns the image');
      it.todo('caches the base image');
      it.todo('caches the resized image');

      it('returns same space avatar for snapshot legacy and non-legacy format', async () => {
        const response1 = await request(server).get('/space/ens.eth');
        const response2 = await request(server).get('/space/s:ens.eth');
        expect(response1.body.toString('base64')).toEqual(response2.body.toString('base64'));

        const response3 = await request(server).get(
          '/space/sn:0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
        );
        const response4 = await request(server).get(
          '/space-sx/0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
        );
        expect(response3.body.toString('base64')).toEqual(response4.body.toString('base64'));
      });

      it('returns different space avatar for different network', async () => {
        const response1 = await request(server).get('/space/s:ens.eth');
        const response2 = await request(server).get('/space/s-tn:ens.eth');
        expect(response1.body.toString('base64')).not.toEqual(response2.body.toString('base64'));
      });

      it('returns same space cover for snapshot legacy and non-legacy format', async () => {
        const response1 = await request(server).get('/space-cover/test.wa0x6e.eth');
        const response2 = await request(server).get('/space-cover/s:test.wa0x6e.eth');
        expect(response1.body.toString('base64')).toEqual(response2.body.toString('base64'));

        const response3 = await request(server).get(
          '/space-cover/sn:0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
        );
        const response4 = await request(server).get(
          '/space-cover-sx/0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
        );
        expect(response3.body.toString('base64')).toEqual(response4.body.toString('base64'));
      });

      it('returns different space cover for different network', async () => {
        const response1 = await request(server).get('/space-cover/s:test.wa0x6e.eth');
        const response2 = await request(server).get('/space-cover/s-tn:test.wa0x6e.eth');
        expect(response1.body.toString('base64')).not.toEqual(response2.body.toString('base64'));
      });
    });

    describe('when the base image is cached, but not the requested size', () => {
      it.todo('resize the image from the cached base image');
      it.todo('caches the resized image');
    });

    describe('when the resized image is cached', () => {
      it.todo('returns the cached resize image');
    });

    it.todo('clears the cache');
  });

  describe('POST /', () => {
    afterEach(async () => {
      await purge();
    });

    describe('when passing invalid method', () => {
      it.todo('returns an error');
    });

    describe('when method is missing', () => {
      it.todo('returns an error');
    });

    describe('on lookup_addresses', () => {
      function fetchLookupAddresses(params: any) {
        return request(server).post('/').send({ method: 'lookup_addresses', params });
      }

      describe('when not passing an array as params', () => {
        const tests = [
          ['a string', 'a simple string'],
          ['an object', { a: 'b' }],
          ['a number', 123],
          ['null', null],
          ['undefined', undefined],
          ['a boolean', true]
        ];
        // @ts-ignore
        it.each(tests)('returns an error when passing %s', async (_: string, params: any) => {
          const response = await fetchLookupAddresses(params);
          expect(response.status).toBe(400);
        });
      });

      describe('when passing EVM addresses', () => {
        it('returns only addresses with associated domains', async () => {
          const response = await fetchLookupAddresses([
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc',
            '0x0C67A201b93cf58D4a5e8D4E970093f0FB4bb0D1'
          ]);

          expect(response.status).toBe(200);
          expect(response.body.result).toEqual({
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC': 'sdntestens.eth',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc': 'sdntestens.eth'
          });
        });
      });

      describe('when passing non-EVM addresses', () => {
        it('returns only addresses with associated domains', async () => {
          const response = await fetchLookupAddresses([
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d',
            '0x040f81578c2ab498c1252fdebdf1ed5dc083906dc7b9e3552c362db1c7c23a02'
          ]);

          expect(response.status).toBe(200);
          expect(response.body.result).toEqual({
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D': 'Checkpoint',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d': 'Checkpoint'
          });
        });
      });

      describe('when passing a mix of EVM and non-EVM addresses', () => {
        it('returns only addresses with associated domains', async () => {
          const response = await fetchLookupAddresses([
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d',
            '0x040f81578c2ab498c1252fdebdf1ed5dc083906dc7b9e3552c362db1c7c23a02',
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc'
          ]);

          expect(response.status).toBe(200);
          expect(response.body.result).toEqual({
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D': 'Checkpoint',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d': 'Checkpoint',
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC': 'sdntestens.eth',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc': 'sdntestens.eth'
          });
        });
      });
    });
  });
});
