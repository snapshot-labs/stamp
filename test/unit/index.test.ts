import express from 'express';
import request from 'supertest';

let app: express.Application;

beforeAll(async () => {
  // src/index.ts listens at import time: capture the app instead of binding a port
  const listen = jest.spyOn(express.application, 'listen').mockReturnValue(undefined as any);
  await import('../../src/index');
  app = listen.mock.instances[0] as unknown as express.Application;
});

describe('unknown routes', () => {
  it.each([
    ['GET', '/nope'],
    ['POST', '/nope'],
    ['GET', '/bogus/0xabc']
  ])('answers %s %s with 404', async (method, path) => {
    const response = await request(app)[method.toLowerCase() as 'get' | 'post'](path);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Not found' });
  });
});
