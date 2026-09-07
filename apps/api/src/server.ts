import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ApiDeps } from './deps.js';
import { sendApiError } from './errors.js';
import { registerAiExplanationRoutes } from './routes/ai-explanation.js';
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
  registerAiExplanationRoutes(app, deps);

  // Global Error Boundary (42_Sprint_5_Review.md M-01): every route above
  // already converts its own known error cases via sendApiError(), but an
  // unhandled exception (a DB/Storage failure that reaches no catch block,
  // a bug) would otherwise fall through to Fastify's default error
  // response — breaking the unified `{ error: { code, message } }`
  // contract and potentially leaking an internal exception message to the
  // client. Logged server-side for observability; the client only ever
  // sees a fixed, generic message.
  app.setErrorHandler((error, _request, reply) => {
    console.error('Unhandled API error', error);
    return sendApiError(reply, 500, 'INTERNAL_ERROR', 'An internal error occurred');
  });

  return app;
}
