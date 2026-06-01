import cors from 'cors';
import express from 'express';
import api from '../../src/api';

export function createTestApp(): express.Application {
  const app = express();

  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ limit: '4mb', extended: false }));
  app.use(cors({ maxAge: 86400 }));
  app.use('/', api);

  return app;
}
