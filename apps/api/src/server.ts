import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ApiDeps } from './deps.js';
import { registerAnalysesRoutes } from './routes/analyses.js';
import { registerProjectsRoutes } from './routes/projects.js';

/**
 * Separated from index.ts's process bootstrap so tests can build a server
 * and use `server.inject()` without binding a real port. Deliberately reads
 * nothing from process.env — every environment-derived value arrives via
 * `deps` (40_Sprint_5_Plan_Review.md F-04).
 */
export async function buildServer(deps: ApiDeps): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cors, { origin: deps.corsOrigin }); // never '*' (39 §16)
  await app.register(multipart, { limits: { fileSize: deps.maxUploadBytes } });
  registerProjectsRoutes(app, deps);
  registerAnalysesRoutes(app, deps);
  return app;
}
