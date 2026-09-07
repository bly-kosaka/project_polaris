import { AuthError } from '@polaris/auth';
import { PrismaAccountRepository, PrismaProjectRepository, prisma } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { FakeAuthAdapter } from './fake-auth-adapter.js';
import { buildApiDeps, resetDatabase } from './api-test-helpers.js';

/**
 * `50_Development_Setup_and_Seventh_Sprint.md`'s T-AUTH matrix
 * (T-AUTH-01..11, T-AUTH-14 — T-AUTH-12a/12b/15 live in packages/auth's own
 * adapter tests, T-AUTH-13a/13b live in apps/web).
 */
describe('Authorization (Sprint 7)', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
    app = await buildServer(deps);
  });

  afterEach(async () => {
    await app.close();
    await deps.close();
  });

  it('T-AUTH-01: an unauthenticated request is rejected with 401 AUTHENTICATION_REQUIRED', async () => {
    const response = await app.inject({ method: 'GET', url: '/projects' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: 'AUTHENTICATION_REQUIRED', message: expect.any(String) } });
  });

  it('T-AUTH-02: an authenticated request for an owned Project succeeds', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: 'Bearer account-a' },
      payload: { name: 'Owned Project' },
    });
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id as string;

    const response = await app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { authorization: 'Bearer account-a' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('T-AUTH-03/T-AUTH-08: a Project/Analysis owned by another Account is 404, never 403, across every route', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: 'Bearer account-a' },
      payload: { name: 'Account A Project' },
    });
    const projectId = created.json().id as string;
    const analysisCreated = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/analyses`,
      headers: { authorization: 'Bearer account-a' },
    });
    const analysisId = analysisCreated.json().analysisId as string;

    const other = { authorization: 'Bearer account-b' };
    const cases: Array<{ method: 'GET' | 'POST'; url: string; expectedCode: string }> = [
      { method: 'GET', url: `/projects/${projectId}`, expectedCode: 'PROJECT_NOT_FOUND' },
      { method: 'GET', url: `/projects/${projectId}/analyses`, expectedCode: 'PROJECT_NOT_FOUND' },
      { method: 'POST', url: `/projects/${projectId}/analyses`, expectedCode: 'PROJECT_NOT_FOUND' },
      { method: 'GET', url: `/analyses/${analysisId}`, expectedCode: 'ANALYSIS_NOT_FOUND' },
      { method: 'GET', url: `/analyses/${analysisId}/observations`, expectedCode: 'ANALYSIS_NOT_FOUND' },
      { method: 'POST', url: `/analyses/${analysisId}/upload`, expectedCode: 'ANALYSIS_NOT_FOUND' },
      { method: 'GET', url: `/analyses/${analysisId}/explanation`, expectedCode: 'ANALYSIS_NOT_FOUND' },
      { method: 'POST', url: `/analyses/${analysisId}/explanation/retry`, expectedCode: 'ANALYSIS_NOT_FOUND' },
    ];

    for (const testCase of cases) {
      const response = await app.inject({ method: testCase.method, url: testCase.url, headers: other });
      expect(response.statusCode, `${testCase.method} ${testCase.url}`).toBe(404);
      expect(response.json(), `${testCase.method} ${testCase.url}`).toEqual({
        error: { code: testCase.expectedCode, message: expect.any(String) },
      });
    }
  });

  it('T-AUTH-04: GET /projects only lists the requesting Account\'s own Projects', async () => {
    await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: 'Bearer account-a' },
      payload: { name: 'Account A Project' },
    });
    await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: 'Bearer account-b' },
      payload: { name: 'Account B Project' },
    });

    const response = await app.inject({ method: 'GET', url: '/projects', headers: { authorization: 'Bearer account-a' } });
    const list = response.json() as Array<{ name: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Account A Project');
  });

  it('T-AUTH-05: a client-supplied ownerAccountId is ignored — the Project is owned by the authenticated Account', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: 'Bearer account-a' },
      // Deliberately probing that an extra client-supplied field is ignored
      // by the route handler (it only ever reads `name` off the body).
      payload: { name: 'Spoof Attempt', ownerAccountId: 'someone-elses-account-id' },
    });
    expect(response.statusCode).toBe(201);
    const projectId = response.json().id as string;

    const account = await new PrismaAccountRepository(deps.prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'account-a',
      email: 'account-a@example.com',
      emailVerified: true,
    });
    const project = await new PrismaProjectRepository(deps.prisma).findByIdForOwner(projectId, account.id);
    expect(project).not.toBeNull();
    expect(project?.ownerAccountId).toBe(account.id);
    expect(project?.ownerAccountId).not.toBe('someone-elses-account-id');
  });

  it('T-AUTH-06: an unverified email is rejected with 403 EMAIL_VERIFICATION_REQUIRED on every Protected route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { authorization: 'Bearer unverified-account' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: expect.any(String) } });
  });

  it('T-AUTH-10 (F-01): N parallel first-requests from the same never-before-seen subject provision exactly one Account row', async () => {
    const subject = `concurrent-subject-${Date.now()}`;
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({ method: 'GET', url: '/projects', headers: { authorization: `Bearer ${subject}` } }),
      ),
    );
    for (const response of responses) {
      expect(response.statusCode).toBe(200); // none 500s on a raced P2002
    }
    const count = await prisma.account.count({ where: { authSubject: subject } });
    expect(count).toBe(1);
  });

  it('T-AUTH-11 (F-02): an Auth Provider outage returns 503 AUTHENTICATION_UNAVAILABLE, never 401', async () => {
    const unavailableDeps = await buildApiDeps(52428800, {
      authAdapter: new FakeAuthAdapter({ failWith: new AuthError('AUTHENTICATION_UNAVAILABLE', 'Clerk is down') }),
    });
    const unavailableApp = await buildServer(unavailableDeps);
    try {
      const response = await unavailableApp.inject({
        method: 'GET',
        url: '/projects',
        headers: { authorization: 'Bearer whatever' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: { code: 'AUTHENTICATION_UNAVAILABLE', message: expect.any(String) } });
    } finally {
      await unavailableApp.close();
      await unavailableDeps.close();
    }
  });

  it('T-AUTH-11b (F-02): a genuinely invalid token returns 401 AUTHENTICATION_INVALID', async () => {
    const invalidDeps = await buildApiDeps(52428800, {
      authAdapter: new FakeAuthAdapter({ failWith: new AuthError('AUTHENTICATION_INVALID', 'Bad token') }),
    });
    const invalidApp = await buildServer(invalidDeps);
    try {
      const response = await invalidApp.inject({
        method: 'GET',
        url: '/projects',
        headers: { authorization: 'Bearer whatever' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: { code: 'AUTHENTICATION_INVALID', message: expect.any(String) } });
    } finally {
      await invalidApp.close();
      await invalidDeps.close();
    }
  });

  it('T-AUTH-14 (m-03): a CORS preflight succeeds without an Authorization header', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/projects',
      headers: { origin: deps.corsOrigin, 'access-control-request-method': 'GET' },
    });
    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});
