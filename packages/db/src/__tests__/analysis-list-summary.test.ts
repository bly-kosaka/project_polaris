import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { persistAnalyzerSuccess } from '../persist-analyzer-result.js';
import { persistUploadedAccessLog } from '../persist-upload.js';
import { buildValidObservationSet, resetDatabase } from './db-test-helpers.js';

// A plain placeholder is fine here — persistUploadedAccessLog doesn't
// validate storage key format, and packages/db has no reason to depend on
// @polaris/storage just to build a realistic-looking one for this test.
function testStorageKey(analysisId: string): string {
  return `raw-logs/${analysisId}/test`;
}

describe('PrismaAnalysisRepository.listSummariesByProjectId (Sprint 5)', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('joins UploadedAccessLog/ObservationSet in one query, degrading gracefully when either is missing or invalid', async () => {
    const projectRepository = new PrismaProjectRepository(prisma);
    const analysisRepository = new PrismaAnalysisRepository(prisma);
    const project = await projectRepository.create({ name: 'List Summary Test' });

    // 1. No upload at all yet.
    const created = await analysisRepository.create({ projectId: project.id });

    // 2. Uploaded but not yet analyzed — originalFileName/fileSizeBytes set, requestCount undefined.
    const uploaded = await analysisRepository.create({ projectId: project.id });
    await persistUploadedAccessLog(prisma, {
      analysisId: uploaded.id,
      originalFileName: 'access.log',
      sizeBytes: 1234,
      storageKey: testStorageKey(uploaded.id),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    // 3. Fully analyzed — requestCount matches the real ObservationSet.
    const analyzed = await analysisRepository.create({ projectId: project.id });
    await persistUploadedAccessLog(prisma, {
      analysisId: analyzed.id,
      originalFileName: 'analyzed.log',
      sizeBytes: 5678,
      storageKey: testStorageKey(analyzed.id),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await analysisRepository.updateStatus(analyzed.id, 'uploaded');
    await analysisRepository.updateStatus(analyzed.id, 'analyzing');
    const observationSet = await buildValidObservationSet();
    await persistAnalyzerSuccess(prisma, { analysisId: analyzed.id, analyzerStatus: 'success', observationSet });

    // 4. A corrupted ObservationSetRecord — must degrade only its own row, not fail the whole call.
    const corrupted = await analysisRepository.create({ projectId: project.id });
    await prisma.observationSetRecord.create({
      data: { analysisId: corrupted.id, schemaVersion: '0.0.0-bogus', data: { unexpectedShape: true } },
    });

    const list = await analysisRepository.listSummariesByProjectId(project.id);
    const find = (id: string) => list.find((a) => a.id === id);

    expect(find(created.id)?.originalFileName).toBeUndefined();
    expect(find(created.id)?.requestCount).toBeUndefined();

    expect(find(uploaded.id)?.originalFileName).toBe('access.log');
    expect(find(uploaded.id)?.fileSizeBytes).toBe(1234);
    expect(find(uploaded.id)?.requestCount).toBeUndefined();

    expect(find(analyzed.id)?.originalFileName).toBe('analyzed.log');
    expect(find(analyzed.id)?.requestCount).toBe(observationSet.overview.totalRequests);

    // The corrupted row's requestCount degrades to undefined; the call itself
    // succeeds and every other row's data is unaffected.
    expect(find(corrupted.id)?.requestCount).toBeUndefined();
    expect(list).toHaveLength(4);
  });
});
