import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { PrismaUploadedAccessLogRepository } from '../uploaded-access-log/prisma-uploaded-access-log-repository.js';
import { createTestAccount, resetDatabase } from './db-test-helpers.js';

describe('PrismaUploadedAccessLogRepository', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function createAnalysis() {
    const account = await createTestAccount(prisma);
    const project = await new PrismaProjectRepository(prisma).create({ name: 'Upload Test Project', ownerAccountId: account.id });
    return new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
  }

  it('creates an UploadedAccessLog at status=uploaded/deletionStatus=pending (F-13)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaUploadedAccessLogRepository(prisma);

    const created = await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 1024,
      storageKey: `raw-logs/${analysis.id}/abc123`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(created.status).toBe('uploaded');
    expect(created.deletionStatus).toBe('pending');
    expect(created.deletedAt).toBeUndefined();

    const found = await repository.findByAnalysisId(analysis.id);
    expect(found).toEqual(created);
  });

  it('markProcessing sets status=processing without touching deletionStatus (T-20)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaUploadedAccessLogRepository(prisma);
    await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 1024,
      storageKey: `raw-logs/${analysis.id}/abc123`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const updated = await repository.markProcessing(analysis.id);
    expect(updated.status).toBe('processing');
    expect(updated.deletionStatus).toBe('pending');
  });

  it('markDeletionSuccess with reason=normal sets status=deleted (T-21)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaUploadedAccessLogRepository(prisma);
    await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 1024,
      storageKey: `raw-logs/${analysis.id}/abc123`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await repository.markProcessing(analysis.id);

    const updated = await repository.markDeletionSuccess(analysis.id, { reason: 'normal' });
    expect(updated.status).toBe('deleted');
    expect(updated.deletionStatus).toBe('success');
    expect(updated.deletedAt).toBeDefined();
  });

  it('markDeletionSuccess with reason=expired sets status=expired, not deleted (T-23)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaUploadedAccessLogRepository(prisma);
    await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 1024,
      storageKey: `raw-logs/${analysis.id}/abc123`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const updated = await repository.markDeletionSuccess(analysis.id, { reason: 'expired' });
    expect(updated.status).toBe('expired');
    expect(updated.status).not.toBe('deleted');
    expect(updated.deletionStatus).toBe('success');
    expect(updated.deletedAt).toBeDefined();
  });

  it('markDeletionFailed sets deletionStatus=failed, leaves status unchanged (T-22 precondition)', async () => {
    const analysis = await createAnalysis();
    const repository = new PrismaUploadedAccessLogRepository(prisma);
    await repository.create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 1024,
      storageKey: `raw-logs/${analysis.id}/abc123`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await repository.markProcessing(analysis.id);

    const failed = await repository.markDeletionFailed(analysis.id);
    expect(failed.status).toBe('processing');
    expect(failed.deletionStatus).toBe('failed');
    expect(failed.deletedAt).toBeUndefined();

    const retried = await repository.markDeletionSuccess(analysis.id, { reason: 'normal' });
    expect(retried.status).toBe('deleted');
    expect(retried.deletionStatus).toBe('success');
  });
});
