import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { PrismaUploadedAccessLogRepository } from '../uploaded-access-log/prisma-uploaded-access-log-repository.js';
import { persistUploadedAccessLog } from '../persist-upload.js';
import { resetDatabase } from './db-test-helpers.js';

describe('persistUploadedAccessLog', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function createAnalysis() {
    const project = await new PrismaProjectRepository(prisma).create({ name: 'Persist Upload Test Project' });
    return new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
  }

  it('inserts UploadedAccessLog and advances Analysis to uploaded, atomically (F-04)', async () => {
    const analysis = await createAnalysis();

    const result = await persistUploadedAccessLog(prisma, {
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 2048,
      storageKey: `raw-logs/${analysis.id}/xyz789`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(result.analysis.status).toBe('uploaded');
    expect(result.uploadedAccessLog.status).toBe('uploaded');
    expect(result.uploadedAccessLog.analysisId).toBe(analysis.id);
  });

  it('rolls back the UploadedAccessLog insert when the Analysis status update fails (T-09)', async () => {
    const analysis = await createAnalysis();
    // Move the Analysis to a terminal state where created -> uploaded is not
    // reachable — persistUploadedAccessLog's Analysis write must fail, and
    // the UploadedAccessLog write from the same transaction must not survive.
    await new PrismaAnalysisRepository(prisma).updateStatus(analysis.id, 'failed');

    await expect(
      persistUploadedAccessLog(prisma, {
        analysisId: analysis.id,
        originalFileName: 'access.log',
        sizeBytes: 2048,
        storageKey: `raw-logs/${analysis.id}/xyz789`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    ).rejects.toThrow();

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(prisma).findByAnalysisId(analysis.id);
    expect(uploadedAccessLog).toBeNull();

    const reloaded = await new PrismaAnalysisRepository(prisma).findById(analysis.id);
    expect(reloaded?.status).toBe('failed');
  });
});
