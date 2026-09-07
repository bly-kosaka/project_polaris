import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaObservationSetRepository } from '../observation-set/prisma-observation-set-repository.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { persistAnalyzerSuccess } from '../persist-analyzer-result.js';
import { buildValidObservationSet, createTestAccount, resetDatabase } from './db-test-helpers.js';

describe('persistAnalyzerSuccess transaction rollback (F-05)', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('rolls back the ObservationSetRecord insert when the status transition is invalid', async () => {
    // Left at 'created' — an invalid pre-state for analyzer_result_ready, so
    // write #1 (ObservationSetRecord insert) succeeds but write #2
    // (updateStatus) throws from assertValidAnalysisStatusTransition. This
    // is the real atomicity proof: an earlier draft that inserted the same
    // analysisId twice only ever failed on write #1 itself, never touching
    // write #2 (32_Sprint_3_Plan_Review.md F-05).
    const account = await createTestAccount(prisma);
    const project = await new PrismaProjectRepository(prisma).create({ name: 'Rollback Test Project', ownerAccountId: account.id });
    const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
    const observationSet = await buildValidObservationSet();

    await expect(
      persistAnalyzerSuccess(prisma, {
        analysisId: analysis.id,
        analyzerStatus: 'success',
        observationSet,
      }),
    ).rejects.toThrow();

    const observationSetRecord = await new PrismaObservationSetRepository(prisma).findByAnalysisId(analysis.id);
    expect(observationSetRecord).toBeNull();

    const reloaded = await new PrismaAnalysisRepository(prisma).findById(analysis.id);
    expect(reloaded?.status).toBe('created');
  });
});
