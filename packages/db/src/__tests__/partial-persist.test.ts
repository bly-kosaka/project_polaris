import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { persistAnalyzerSuccess } from '../persist-analyzer-result.js';
import { buildValidObservationSet, createAnalysisInAnalyzingState, resetDatabase } from './db-test-helpers.js';

describe('persistAnalyzerSuccess with analyzerStatus=partial', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('still creates an ObservationSetRecord and never sets a top-level partial status', async () => {
    const { analysisId } = await createAnalysisInAnalyzingState(prisma);
    const observationSet = await buildValidObservationSet();

    const result = await persistAnalyzerSuccess(prisma, {
      analysisId,
      analyzerStatus: 'partial',
      observationSet,
    });

    expect(result.observationSetRecord).not.toBeNull();
    expect(result.analysis.status).toBe('analyzer_result_ready');
    expect(result.analysis.status).not.toBe('partial');
    expect(result.analysis.analyzerStatus).toBe('partial');
  });
});
