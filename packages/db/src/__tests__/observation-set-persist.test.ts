import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaObservationSetRepository } from '../observation-set/prisma-observation-set-repository.js';
import { persistAnalyzerSuccess } from '../persist-analyzer-result.js';
import { buildValidObservationSet, createAnalysisInAnalyzingState, resetDatabase } from './db-test-helpers.js';

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
});
