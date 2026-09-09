import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaObservationSetRepository } from '../observation-set/prisma-observation-set-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { persistAnalyzerSuccess } from '../persist-analyzer-result.js';
import { buildValidObservationSet, createAnalysisInAnalyzingState, createTestAccount, resetDatabase } from './db-test-helpers.js';

describe('persistAnalyzerSuccess', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('persists the ObservationSet and advances Analysis to analyzer_result_ready', async () => {
    const { analysisId } = await createAnalysisInAnalyzingState(prisma);
    const observationSet = await buildValidObservationSet();

    const result = await persistAnalyzerSuccess(prisma, {
      analysisId,
      analyzerStatus: 'success',
      observationSet,
    });

    expect(result.analysis.status).toBe('analyzer_result_ready');
    expect(result.analysis.analyzerStatus).toBe('success');
    expect(result.observationSetRecord.analysisId).toBe(analysisId);
    expect(result.observationSetRecord.schemaVersion).toBe(observationSet.schemaVersion);

    const read = await new PrismaObservationSetRepository(prisma).findByAnalysisId(analysisId);
    expect(read).not.toBeNull();
    expect(read?.data.schemaVersion).toBe(observationSet.schemaVersion);
  });

  it('T-USAGE-01: records exactly one UsageEvent (metric=analysis_completed) in the same transaction as the ObservationSet write', async () => {
    const account = await createTestAccount(prisma);
    const project = await new PrismaProjectRepository(prisma).create({ name: 'Usage Test Project', ownerAccountId: account.id });
    const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
    await new PrismaAnalysisRepository(prisma).updateStatus(analysis.id, 'uploaded');
    await new PrismaAnalysisRepository(prisma).updateStatus(analysis.id, 'analyzing');
    const observationSet = await buildValidObservationSet();

    await persistAnalyzerSuccess(prisma, { analysisId: analysis.id, analyzerStatus: 'success', observationSet });

    const usageEvents = await prisma.usageEvent.findMany({ where: { analysisId: analysis.id } });
    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0]?.accountId).toBe(account.id);
    expect(usageEvents[0]?.metric).toBe('analysis_completed');
  });

  it('T-USAGE-05: UsageEvent counts stay isolated per Account', async () => {
    const accountA = await createTestAccount(prisma);
    const accountB = await createTestAccount(prisma);
    const projectA = await new PrismaProjectRepository(prisma).create({ name: 'Account A Project', ownerAccountId: accountA.id });
    const projectB = await new PrismaProjectRepository(prisma).create({ name: 'Account B Project', ownerAccountId: accountB.id });

    async function completeAnalysis(projectId: string): Promise<void> {
      const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId });
      await new PrismaAnalysisRepository(prisma).updateStatus(analysis.id, 'uploaded');
      await new PrismaAnalysisRepository(prisma).updateStatus(analysis.id, 'analyzing');
      const observationSet = await buildValidObservationSet();
      await persistAnalyzerSuccess(prisma, { analysisId: analysis.id, analyzerStatus: 'success', observationSet });
    }

    await completeAnalysis(projectA.id);
    await completeAnalysis(projectA.id);
    await completeAnalysis(projectB.id);

    const usageA = await prisma.usageEvent.findMany({ where: { accountId: accountA.id } });
    const usageB = await prisma.usageEvent.findMany({ where: { accountId: accountB.id } });
    expect(usageA).toHaveLength(2);
    expect(usageB).toHaveLength(1);
  });
});
