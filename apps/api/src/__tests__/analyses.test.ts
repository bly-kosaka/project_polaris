import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { PrismaAnalysisRepository, PrismaProjectRepository, PrismaUploadedAccessLogRepository } from '@polaris/db';
import { buildAnalyzerJobId } from '@polaris/queue';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { BUCKET, buildApiDeps, buildMultipartUpload, readFixture, resetDatabase } from './api-test-helpers.js';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'polaris',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'polaris123',
  },
});

async function listObjectsUnderAnalysis(analysisId: string): Promise<number> {
  const result = await s3Client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `raw-logs/${analysisId}/` }),
  );
  return result.KeyCount ?? 0;
}

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

  it('POST /projects/:projectId/analyses returns 404 PROJECT_NOT_FOUND for an unknown project', async () => {
    const response = await app.inject({ method: 'POST', url: '/projects/nonexistent-id/analyses' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'PROJECT_NOT_FOUND', message: expect.any(String) } });
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
    expect(response.json()).toEqual({ error: { code: 'ANALYSIS_NOT_FOUND', message: expect.any(String) } });
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
    // Status already moved to 'uploaded' after the first successful upload,
    // so the created-state check (checked first) is what actually rejects
    // this — ANALYSIS_NOT_IN_CREATED_STATE, not UPLOAD_ALREADY_EXISTS (that
    // code is for the narrower race where status is still 'created' but an
    // UploadedAccessLog row already exists).
    expect(second.json()).toEqual({ error: { code: 'ANALYSIS_NOT_IN_CREATED_STATE', message: expect.any(String) } });
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
      expect(response.json()).toEqual({ error: { code: 'UPLOAD_TOO_LARGE', message: expect.any(String) } });

      const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
      expect(analysis?.status).toBe('created');

      const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(
        analysisId,
      );
      expect(uploadedAccessLog).toBeNull();

      const job = await deps.analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
      expect(job).toBeUndefined();

      // m-01 (36_Sprint_4_Review.md): confirm the Object was actually
      // removed from MinIO, not just that the DB/Queue never learned its
      // key — the compensating delete could silently no-op and this
      // assertion would previously still have passed.
      expect(await listObjectsUnderAnalysis(analysisId)).toBe(0);
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
    expect(response.json()).toEqual({ error: { code: 'FILE_REQUIRED', message: expect.any(String) } });
  });

  it('GET /analyses/:analysisId returns 404 for an unknown id', async () => {
    const response = await app.inject({ method: 'GET', url: '/analyses/nonexistent-id' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'ANALYSIS_NOT_FOUND', message: expect.any(String) } });
  });

  it('GET /analyses/:analysisId returns an AnalysisDetailDto with originalFileName/fileSizeBytes from UploadedAccessLog, never a storageKey', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const { body, contentType } = buildMultipartUpload({
      fieldName: 'file',
      filename: 'valid.log',
      content: readFixture('valid.log'),
    });
    await app.inject({
      method: 'POST',
      url: `/analyses/${analysisId}/upload`,
      payload: body,
      headers: { 'content-type': contentType },
    });

    const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}` });
    expect(response.statusCode).toBe(200);
    const dto = response.json();
    expect(dto).toMatchObject({ id: analysisId, status: 'uploaded', originalFileName: 'valid.log' });
    expect(typeof dto.fileSizeBytes).toBe('number');
    expect(dto).not.toHaveProperty('storageKey');
    expect(dto).not.toHaveProperty('metadata');
  });

  it('GET /analyses/:analysisId/observations returns 404 before an ObservationSet exists', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}/observations` });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'OBSERVATION_SET_NOT_READY', message: expect.any(String) } });
  });

  it('GET /analyses/:analysisId/observations returns 409 ANALYSIS_FAILED for a Fatal Analysis, not a generic not-ready', async () => {
    const { analysisId } = await createProjectAndAnalysis();
    const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
    await analysisRepository.updateStatus(analysisId, 'failed', { analyzerStatus: 'failed' });

    const response = await app.inject({ method: 'GET', url: `/analyses/${analysisId}/observations` });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'ANALYSIS_FAILED', message: expect.any(String) } });
  });
});
