import { PrismaAccountRepository, PrismaAnalysisRepository, PrismaProjectRepository } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { buildApiDeps, resetDatabase } from './api-test-helpers.js';

const AUTH = { authorization: 'Bearer test-account' };

describe('projects routes', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let app: FastifyInstance;
  let ownerAccountId: string;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
    app = await buildServer(deps);
    // FakeAuthAdapter's identity function maps the 'test-account' Bearer
    // token to this same Account row — every direct-repository Project
    // creation below is scoped to it so the routes' own ownership checks
    // (requireOwnedProject) find it.
    const account = await new PrismaAccountRepository(deps.prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'test-account',
      email: 'test-account@example.com',
      emailVerified: true,
    });
    ownerAccountId = account.id;
  });

  afterAll(async () => {
    await app.close();
    await deps.close();
  });

  it('POST /projects creates a Project, trimming the name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: AUTH,
      payload: { name: '  My Project  ' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('My Project');
    expect(body.status).toBe('active');
    expect(typeof body.id).toBe('string');
  });

  it('POST /projects rejects an empty name', async () => {
    const response = await app.inject({ method: 'POST', url: '/projects', headers: AUTH, payload: { name: '   ' } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } });
  });

  it('POST /projects rejects a missing name', async () => {
    const response = await app.inject({ method: 'POST', url: '/projects', headers: AUTH, payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } });
  });

  it('POST /projects rejects a name over the max length', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: AUTH,
      payload: { name: 'a'.repeat(201) },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } });
  });

  it('GET /projects lists Projects with analysisCount/latestAnalysisAt, no N+1', async () => {
    const projectRepository = new PrismaProjectRepository(deps.prisma);
    const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
    const withAnalysis = await projectRepository.create({ name: 'Has One Analysis', ownerAccountId });
    await analysisRepository.create({ projectId: withAnalysis.id });
    await projectRepository.create({ name: 'No Analyses', ownerAccountId });

    const response = await app.inject({ method: 'GET', url: '/projects', headers: AUTH });
    expect(response.statusCode).toBe(200);
    const list = response.json();
    expect(Array.isArray(list)).toBe(true);

    const found = list.find((p: { id: string }) => p.id === withAnalysis.id);
    expect(found.analysisCount).toBe(1);
    expect(typeof found.latestAnalysisAt).toBe('string');
  });

  it('GET /projects/:projectId returns 404 for an unknown id', async () => {
    const response = await app.inject({ method: 'GET', url: '/projects/nonexistent-id', headers: AUTH });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'PROJECT_NOT_FOUND', message: expect.any(String) } });
  });

  it('GET /projects/:projectId returns the Project detail', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Detail Test', ownerAccountId });
    const response = await app.inject({ method: 'GET', url: `/projects/${project.id}`, headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: project.id, name: 'Detail Test', status: 'active' });
  });

  it('GET /projects/:projectId returns 404 for another Account\'s Project (anti-enumeration)', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Not Yours', ownerAccountId });
    const response = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}`,
      headers: { authorization: 'Bearer another-account' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'PROJECT_NOT_FOUND', message: expect.any(String) } });
  });

  it('GET /projects/:projectId/analyses returns 404 for an unknown project', async () => {
    const response = await app.inject({ method: 'GET', url: '/projects/nonexistent-id/analyses', headers: AUTH });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'PROJECT_NOT_FOUND', message: expect.any(String) } });
  });

  it('GET /projects/:projectId/analyses returns an empty array for a Project with no Analyses', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Empty Analyses', ownerAccountId });
    const response = await app.inject({ method: 'GET', url: `/projects/${project.id}/analyses`, headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('GET /projects/:projectId/analyses reports requestCount as undefined before an ObservationSet exists', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Pending Analysis', ownerAccountId });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });

    const response = await app.inject({ method: 'GET', url: `/projects/${project.id}/analyses`, headers: AUTH });
    expect(response.statusCode).toBe(200);
    const list = response.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(analysis.id);
    expect(list[0].requestCount).toBeUndefined();
  });

  it('GET /projects without Authorization returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/projects' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: 'AUTHENTICATION_REQUIRED', message: expect.any(String) } });
  });
});
