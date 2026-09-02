import { PrismaAnalysisRepository, PrismaProjectRepository, PrismaUploadedAccessLogRepository } from '@polaris/db';
import type { CleanupExpiredRawLogsJobData } from '@polaris/queue';
import { buildRawLogStorageKey } from '@polaris/storage';
import { Readable } from 'node:stream';
import type { Job } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleCleanupJob } from '../cleanup-job-handler.js';
import { buildWorkerDeps, resetDatabase } from './worker-test-helpers.js';

const fakeCleanupJob = { data: { scheduledAt: new Date().toISOString() } } as unknown as Job<CleanupExpiredRawLogsJobData>;

describe('handleCleanupJob', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  async function createUpload(expiresAt: Date) {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: `Cleanup Test ${Date.now()}` });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
    const storageKey = buildRawLogStorageKey(analysis.id);
    await deps.storage.putObject({ key: storageKey, body: Readable.from(['line\n']) });
    await new PrismaUploadedAccessLogRepository(deps.prisma).create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 5,
      storageKey,
      expiresAt: expiresAt.toISOString(),
    });
    return { analysisId: analysis.id, storageKey };
  }

  it('T-14/T-23: deletes an expired Raw Log and marks status=expired (not deleted)', async () => {
    const { analysisId, storageKey } = await createUpload(new Date(Date.now() - 60 * 60 * 1000)); // 1h in the past

    await handleCleanupJob(fakeCleanupJob, deps);

    const updated = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(updated?.status).toBe('expired');
    expect(updated?.status).not.toBe('deleted');
    expect(updated?.deletionStatus).toBe('success');
    expect(await deps.storage.exists(storageKey)).toBe(false);
  });

  it('leaves a not-yet-expired Raw Log untouched', async () => {
    const { analysisId, storageKey } = await createUpload(new Date(Date.now() + 24 * 60 * 60 * 1000)); // 24h ahead

    await handleCleanupJob(fakeCleanupJob, deps);

    const updated = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(updated?.status).toBe('uploaded');
    expect(await deps.storage.exists(storageKey)).toBe(true);
  });

  it('leaves an already-deleted row alone', async () => {
    const { analysisId } = await createUpload(new Date(Date.now() - 60 * 60 * 1000));
    await new PrismaUploadedAccessLogRepository(deps.prisma).markDeletionSuccess(analysisId, { reason: 'normal' });

    await expect(handleCleanupJob(fakeCleanupJob, deps)).resolves.toBeUndefined();
    const updated = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(updated?.status).toBe('deleted');
  });
});
