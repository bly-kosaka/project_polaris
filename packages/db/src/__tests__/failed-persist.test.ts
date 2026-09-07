import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { PrismaObservationSetRepository } from '../observation-set/prisma-observation-set-repository.js';
import { PrismaProjectRepository } from '../project/prisma-project-repository.js';
import { persistAnalyzerFailure } from '../persist-analyzer-result.js';
import { createTestAccount, resetDatabase } from './db-test-helpers.js';

describe('persistAnalyzerFailure', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('sets Analysis.status to failed and never creates an ObservationSetRecord', async () => {
    const account = await createTestAccount(prisma);
    const project = await new PrismaProjectRepository(prisma).create({ name: 'Failed Persist Test Project', ownerAccountId: account.id });
    const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId: project.id });

    const result = await persistAnalyzerFailure(prisma, { analysisId: analysis.id });

    expect(result.status).toBe('failed');
    expect(result.analyzerStatus).toBe('failed');

    const observationSetRecord = await new PrismaObservationSetRepository(prisma).findByAnalysisId(analysis.id);
    expect(observationSetRecord).toBeNull();
  });
});
