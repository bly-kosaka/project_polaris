import { PrismaAnalysisRepository, PrismaProjectRepository, persistUploadedAccessLog } from '@polaris/db';
import { buildAnalyzerJobId } from '@polaris/queue';
import { buildRawLogStorageKey } from '@polaris/storage';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { recoverAnalyzerEnqueue } from '../recovery/recover-analyzer-enqueue.js';
import { buildApiDeps, resetDatabase } from './api-test-helpers.js';

describe('recoverAnalyzerEnqueue (T-18)', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('enqueues the Analyzer job for an uploaded Analysis with no ObservationSet yet', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Recovery Test' });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
    // Simulates: Storage Put + DB persist succeeded, but the enqueue call
    // that should normally follow failed (F-02/T-10) — Analysis is left at
    // 'uploaded' with no queued job, exactly the state recovery targets.
    await persistUploadedAccessLog(deps.prisma, {
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 100,
      storageKey: buildRawLogStorageKey(analysis.id),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const before = await deps.analyzerQueue.getJob(buildAnalyzerJobId(analysis.id));
    expect(before).toBeUndefined();

    const outcome = await recoverAnalyzerEnqueue(analysis.id, deps);
    expect(outcome).toBe('enqueued');

    const after = await deps.analyzerQueue.getJob(buildAnalyzerJobId(analysis.id));
    expect(after).toBeDefined();
    expect(after?.data).toEqual({ analysisId: analysis.id });
  });

  it('is a no-op for an Analysis that is not in the uploaded state', async () => {
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: 'Recovery Noop Test' });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });

    const outcome = await recoverAnalyzerEnqueue(analysis.id, deps);
    expect(outcome).toBe('skipped');

    const job = await deps.analyzerQueue.getJob(buildAnalyzerJobId(analysis.id));
    expect(job).toBeUndefined();
  });
});
