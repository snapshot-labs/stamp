jest.unmock('../../src/helpers/redis');

import { Server } from 'http';
import express from 'express';
import sharp from 'sharp';
import request from 'supertest';
import redis from '../../src/helpers/redis';
import { KEY_PREFIX } from '../../src/resolvers/address/cache';
import { remoteSnapshotInputs } from '../fixtures/image-snapshot-addresses';

let app: express.Application;

async function purge(): Promise<void> {
  if (!redis) return;

  const keys = await redis.keys(`${KEY_PREFIX}:*`);
  const transaction = redis.multi();

  keys.map((key: string) => transaction.del(key));
  await transaction.exec();
}

async function getResolvedImage(path: string) {
  const response = await request(app).get(path);

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toMatch(/^image\/webp/);
  expect(response.headers['cache-control']).toBe('public, max-age=43200');
  return response.body as Buffer;
}

function rpc(method: string, params: unknown, network?: string) {
  return request(app).post('/').send({ id: 1, method, params, network });
}

describe('E2E api', () => {
  beforeAll(async () => {
    const listen = jest
      .spyOn(express.application, 'listen')
      .mockReturnValue(undefined as unknown as Server);
    await import('../../src/index');
    app = listen.mock.instances[0] as unknown as express.Application;
  });

  describe('GET type/TYPE/ID', () => {
    it.concurrent('returns a resolved avatar at the requested size', async () => {
      const image = await getResolvedImage(
        `/avatar/${remoteSnapshotInputs.snapshotUserAvatar}?s=48`
      );
      const { format, width, height } = await sharp(image).metadata();
      expect({ format, width, height }).toEqual({ format: 'webp', width: 48, height: 48 });
    });

    it.concurrent(
      'returns the fallback with a short cache when the space has no avatar',
      async () => {
        const response = await request(app).get('/space/no-such-space-stamp-e2e.eth');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/^image\/webp/);
        expect(response.headers['cache-control']).toBe('public, max-age=3600');
      }
    );

    it.concurrent(
      'returns same space avatar for snapshot legacy and non-legacy format',
      async () => {
        expect(await getResolvedImage('/space/ens.eth')).toEqual(
          await getResolvedImage('/space/s:ens.eth')
        );
        expect(
          await getResolvedImage(
            '/space/sn:0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
          )
        ).toEqual(
          await getResolvedImage(
            '/space-sx/0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
          )
        );
      }
    );

    it.concurrent('returns different space avatar for different network', async () => {
      const response1 = await request(app).get('/space/s:ens.eth');
      const response2 = await request(app).get('/space/s-tn:ens.eth');
      expect(response1.body.toString('base64')).not.toEqual(response2.body.toString('base64'));
    });

    it.concurrent(
      'returns same space cover for snapshot legacy and non-legacy format',
      async () => {
        expect(await getResolvedImage('/space-cover/test.wa0x6e.eth')).toEqual(
          await getResolvedImage('/space-cover/s:test.wa0x6e.eth')
        );
        expect(
          await getResolvedImage(
            '/space-cover/sn:0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
          )
        ).toEqual(
          await getResolvedImage(
            '/space-cover-sx/0x07c251045154318a2376a3bb65be47d3c90df1740d8e35c9b9d943aa3f240e50'
          )
        );
      }
    );

    it.concurrent('returns different space cover for different network', async () => {
      const response1 = await request(app).get('/space-cover/s:test.wa0x6e.eth');
      const response2 = await request(app).get('/space-cover/s-tn:test.wa0x6e.eth');
      expect(response1.body.toString('base64')).not.toEqual(response2.body.toString('base64'));
    });
  });

  describe('POST /', () => {
    it.concurrent(
      'lookup_addresses returns only EVM and Starknet addresses with a domain',
      async () => {
        await purge();
        const response = await rpc('lookup_addresses', [
          '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D',
          '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d',
          '0x040f81578c2ab498c1252fdebdf1ed5dc083906dc7b9e3552c362db1c7c23a02',
          '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC',
          '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc'
        ]);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          jsonrpc: '2.0',
          result: {
            '0x07FF6B17F07C4D83236E3FC5F94259A19D1ED41BBCF1822397EA17882E9B038D': 'Checkpoint',
            '0x07ff6b17f07c4d83236e3fc5f94259a19d1ed41bbcf1822397ea17882e9b038d': 'Checkpoint',
            '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC': 'sdntestens.eth',
            '0xe6d0dd18c6c3a9af8c2fab57d6e6a38e29d513cc': 'sdntestens.eth'
          },
          id: 1
        });
      }
    );

    it.concurrent('resolve_names returns the address of a name', async () => {
      await purge();
      const response = await rpc('resolve_names', ['vitalik.eth']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        result: { 'vitalik.eth': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
        id: 1
      });
    });

    it.concurrent('lookup_domains returns the domains owned by an address', async () => {
      const response = await rpc('lookup_domains', '0x279489452dd8035f82326c8036f81d7bd1c65e6c');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        result: expect.arrayContaining(['global.aragonid.eth']),
        id: 1
      });
    });

    it.concurrent('get_owner returns the owner of a name', async () => {
      const response = await rpc('get_owner', 'boorger.shib', '109');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        result: '0x220bc93D88C0aF11f1159eA89a885d5ADd3A7Cf6',
        id: 1
      });
    });

    it('caches lookup_addresses results in redis until cleared', async () => {
      const address = '0xE6D0Dd18C6C3a9Af8C2FaB57d6e6A38E29d513cC';
      const key = `${KEY_PREFIX}:${address}`;
      await purge();

      expect((await rpc('lookup_addresses', [address])).body.result).toEqual({
        [address]: 'sdntestens.eth'
      });
      expect(await redis!.get(key)).toBe('sdntestens.eth');

      await redis!.set(key, 'from-cache.eth');
      expect((await rpc('lookup_addresses', [address])).body.result).toEqual({
        [address]: 'from-cache.eth'
      });

      const cleared = await request(app).get(`/clear/address/${address.toLowerCase()}`);
      expect(cleared.status).toBe(200);
      expect(await redis!.exists(key)).toBe(0);
    });
  });
});
