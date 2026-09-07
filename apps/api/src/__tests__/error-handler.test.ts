import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiDeps } from '../deps.js';
import { buildServer } from '../server.js';
import { buildApiDeps, resetDatabase } from './api-test-helpers.js';

/**
 * Regression test for 42_Sprint_5_Review.md M-01: before `buildServer()`
 * registered a global error handler, an unhandled exception from a Route
 * (e.g. a Repository call whose own try/catch didn't apply, or a genuine
 * bug) fell through to Fastify's default error response — breaking the
 * unified `{ error: { code, message } }` contract and risking an internal
 * exception message reaching the client.
 */
function withFailingProjectFindMany(base: ApiDeps['prisma'], message: string): ApiDeps['prisma'] {
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== 'project') return Reflect.get(target, prop, receiver);
      const delegate = Reflect.get(target, prop, receiver) as unknown as Record<string, unknown>;
      return new Proxy(delegate, {
        get(delegateTarget, delegateProp, delegateReceiver) {
          if (delegateProp !== 'findMany') return Reflect.get(delegateTarget, delegateProp, delegateReceiver);
          return () => Promise.reject(new Error(message));
        },
      });
    },
  }) as ApiDeps['prisma'];
}

describe('Global Error Boundary', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
  });

  afterEach(async () => {
    await app.close();
    await deps.close();
  });

  it('converts an unhandled Repository exception into the unified error contract, never the raw message', async () => {
    const secretDetail = 'connection to db.internal.prod:5432 refused — password authentication failed for user polaris';
    app = await buildServer({ ...deps, prisma: withFailingProjectFindMany(deps.prisma, secretDetail) });

    const response = await app.inject({ method: 'GET', url: '/projects' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } });
    expect(response.body).not.toContain(secretDetail);
    expect(response.body).not.toContain('polaris');
  });
});
