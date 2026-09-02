import { PrismaAnalysisRepository, PrismaProjectRepository, PrismaUploadedAccessLogRepository } from '@polaris/db';
import { buildAnalyzerJobId } from '@polaris/queue';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { buildApiDeps, buildMultipartUpload, readFixture, resetDatabase } from './api-test-helpers.js';

describe('analyses routes', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
    app = await buildServer(deps);
  });

  afterAll(async () => {
    await app.close();
    await deps.close();
  });

  async function createProjectAndAnalysis() {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: `API Test ${Date.now()}` });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
    return { projectId: project.id, analysisId: analysis.id };
  }

  it('POST /projects/:projectId/analyses creates an Analysis at status=created', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Create Route Test' });
    const response = await app.inject({ method: 'POST', url: `/projects/${project.id}/analyses` });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('created');
    expect(typeof body.analysisId).toBe('string');
  });

  it('upload happy path: enqueues the Analyzer job with the deterministic jobId', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const { body, contentType } = buildMultipartUpload({
      fieldName: 'file',
      filename: 'valid.log',
      content: readFixture('valid.log'),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/analyses/${analysisId}/upload`,
      payload: body,
      headers: { 'content-type': contentType },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe('uploaded');

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('uploaded');

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.originalFileName).toBe('valid.log');
    expect(uploadedAccessLog?.status).toBe('uploaded');

    const job = await deps.analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
    expect(job).toBeDefined();
    expect(job?.data).toEqual({ analysisId });
  });

  it('rejects upload for an unknown Analysis', async () => {
    const { body, contentType } = buildMultipartUpload({
      fieldName: 'file',
      filename: 'valid.log',
      content: readFixture('valid.log'),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/analyses/nonexistent-id/upload',
      payload: body,
      headers: { 'content-type': contentType },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects a second upload for an Analysis that already has one (T-09 precondition guard)', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const { body, contentType } = buildMultipartUpload({
      fieldName: 'file',
      filename: 'valid.log',
      content: readFixture('valid.log'),
    });

    const first = await app.inject({
      method: 'POST',
      url: `/analyses/${analysisId}/upload`,
      payload: body,
      headers: { 'content-type': contentType },
    });
    expect(first.statusCode).toBe(202);

    const second = await app.inject({
      method: 'POST',
      url: `/analyses/${analysisId}/upload`,
      payload: body,
      headers: { 'content-type': contentType },
    });
    expect(second.statusCode).toBe(409);
  });

  it('T-08: an oversized upload is rejected and leaves no Storage/DB/Queue residue', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const smallLimitDeps = await buildApiDeps(10); // 10 bytes — the fixture is much larger
    const smallLimitApp = await buildServer(smallLimitDeps);

    const { body, contentType } = buildMultipartUpload({
      fieldName: 'file',
      filename: 'valid.log',
      content: readFixture('valid.log'),
    });

    try {
      const response = await smallLimitApp.inject({
        method: 'POST',
        url: `/analyses/${analysisId}/upload`,
        payload: body,
        headers: { 'content-type': contentType },
      });
      expect(response.statusCode).toBe(413);

      const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
      expect(analysis?.status).toBe('created');

      const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(
        analysisId,
      );
      expect(uploadedAccessLog).toBeNull();

      const job = await deps.analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
      expect(job).toBeUndefined();
    } finally {
      await smallLimitApp.close();
      await smallLimitDeps.close();
    }
  });

  it('rejects upload with no file', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const response = await app.inject({
      method: 'POST',
      url: `/analyses/${analysisId}/upload`,
      payload: Buffer.from(''),
      headers: { 'content-type': 'multipart/form-data; boundary=empty' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('GET /analyses/:analysisId returns 404 for an unknown id', async () => {
    const response = await app.inject({ method: 'GET', url: '/analyses/nonexistent-id' });
    expect(response.statusCode).toBe(404);
  });

  it('GET /analyses/:analysisId/observations returns 404 before an ObservationSet exists', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}/observations` });
    expect(response.statusCode).toBe(404);
  });
});
