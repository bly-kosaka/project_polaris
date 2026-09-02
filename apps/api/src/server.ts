import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ApiDeps } from './deps.js';
import { registerAnalysesRoutes } from './routes/analyses.js';

/**
 * Separated from index.ts's process bootstrap so tests can build a server
 * and use `server.inject()` without binding a real port.
 */
export async function buildServer(deps: ApiDeps): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(multipart, { limits: { fileSize: deps.maxUploadBytes } });
  registerAnalysesRoutes(app, deps);
  return app;
}
