import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAuthenticateHook } from './auth/authenticate.js';
import { createRequireVerifiedEmailHook } from './auth/require-verified-email.js';
import './auth/types.js';
import type { ApiDeps } from './deps.js';
import { sendApiError } from './errors.js';
import { registerAiExplanationRoutes } from './routes/ai-explanation.js';
import { registerAnalysesRoutes } from './routes/analyses.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerProjectsRoutes } from './routes/projects.js';
import { registerStripeWebhookRoute } from './routes/stripe-webhook.js';

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

  // Declared as `undefined` at runtime — the `authenticate` hook below is
  // what actually assigns a real value on every request before any route
  // handler runs. Cast past Fastify's decorateRequest typing (which expects
  // a value already matching the declared, non-optional Account/
  // AuthenticatedPrincipal types from ./auth/types.ts) since the real
  // runtime guarantee comes from hook ordering, not from this line.
  // Decorators are visible from every child scope registered below, so
  // this stays root-level regardless of which scope actually assigns them.
  app.decorateRequest('account', undefined as never);
  app.decorateRequest('principal', undefined as never);

  // Global Error Boundary (42_Sprint_5_Review.md M-01): every route below
  // already converts its own known error cases via sendApiError(), but an
  // unhandled exception (a DB/Storage failure that reaches no catch block,
  // a bug) would otherwise fall through to Fastify's default error
  // response — breaking the unified `{ error: { code, message } }`
  // contract and potentially leaking an internal exception message to the
  // client. Logged server-side for observability; the client only ever
  // sees a fixed, generic message. Registered on the root BEFORE either
  // child scope below — Fastify's error-handler encapsulation is resolved
  // at each child's definition time, so setting this any later would leave
  // routes already registered in a child using Fastify's own generic
  // default handler instead of this one.
  app.setErrorHandler((error, _request, reply) => {
    console.error('Unhandled API error', error);
    return sendApiError(reply, 500, 'INTERNAL_ERROR', 'An internal error occurred');
  });

  // Public Scope (57_Development_Setup_and_Eighth_Sprint.md §21) — the
  // Stripe Webhook, the only route that must never go through Clerk
  // Authentication. Fastify Encapsulation means the Protected Scope's
  // hooks below are structurally invisible here — never an
  // `if (path === '/webhooks/stripe')` branch inside authenticate.ts.
  await app.register(async (publicScope) => {
    // Stripe Signature Verification (§22) must run against the exact raw
    // bytes Stripe signed — never JSON.parse'd and re-stringified first,
    // which could change the byte sequence. Scoped to this child context
    // only (Fastify's own docs confirm addContentTypeParser is
    // encapsulated per-scope), so every other route's normal JSON body
    // parsing is unaffected.
    publicScope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });
    registerStripeWebhookRoute(publicScope, deps);
  });

  // Protected Scope — every existing Product Resource route registrar,
  // plus the two global Auth hooks (50_Development_Setup_and_Seventh_Sprint.md
  // decision 5) registered inside this child context rather than on the
  // root `app`, so they never apply to the Public Scope above. CORS
  // preflight (OPTIONS) requests never reach either scope's hooks —
  // @fastify/cors (registered on the root app) short-circuits them itself
  // (m-03) before Fastify ever routes into a child context.
  await app.register(async (protectedScope) => {
    protectedScope.addHook('preHandler', createAuthenticateHook(deps));
    protectedScope.addHook('preHandler', createRequireVerifiedEmailHook());

    registerProjectsRoutes(protectedScope, deps);
    registerAnalysesRoutes(protectedScope, deps);
    registerAiExplanationRoutes(protectedScope, deps);
    registerBillingRoutes(protectedScope, deps);
  });

  return app;
}
