import { PrismaAnalysisRepository, PrismaProjectRepository, PrismaUploadedAccessLogRepository } from '@polaris/db';
import type { RawLogDeleteJobData } from '@polaris/queue';
import { buildRawLogStorageKey } from '@polaris/storage';
import { Readable } from 'node:stream';
import type { Job } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleRawLogDeleteJob } from '../raw-log-delete-job-handler.js';
import { buildWorkerDeps, resetDatabase } from './worker-test-helpers.js';

function fakeDeleteJob(analysisId: string): Job<RawLogDeleteJobData> {
  return { data: { analysisId } } as unknown as Job<RawLogDeleteJobData>;
}

describe('handleRawLogDeleteJob', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('T-07/T-22: retries a previously-failed delete and marks it deleted/success', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Delete Retry Test' });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
    const storageKey = buildRawLogStorageKey(analysis.id);
    const repository = new PrismaUploadedAccessLogRepository(deps.prisma);

    await deps.storage.putObject({ key: storageKey, body: Readable.from(['sample line\n']) });
    await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 12,
      storageKey,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await repository.markProcessing(analysis.id);
    await repository.markDeletionFailed(analysis.id); // simulate the original delete having failed

    await handleRawLogDeleteJob(fakeDeleteJob(analysis.id), deps);

    const updated = await repository.findByAnalysisId(analysis.id);
    expect(updated?.status).toBe('deleted');
    expect(updated?.deletionStatus).toBe('success');
    expect(updated?.deletedAt).toBeDefined();
    expect(await deps.storage.exists(storageKey)).toBe(false);
  });

  it('is a no-op when the UploadedAccessLog is already deleted', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Delete Retry Noop Test' });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
    const storageKey = buildRawLogStorageKey(analysis.id);
    const repository = new PrismaUploadedAccessLogRepository(deps.prisma);

    await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 12,
      storageKey,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await repository.markDeletionSuccess(analysis.id, { reason: 'normal' });

    await expect(handleRawLogDeleteJob(fakeDeleteJob(analysis.id), deps)).resolves.toBeUndefined();
  });
});
