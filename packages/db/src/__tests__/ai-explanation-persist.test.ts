import type { AIExplanationResult } from '@polaris/ai';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../client.js';
import { PrismaAIExplanationRepository } from '../ai-explanation/prisma-ai-explanation-repository.js';
import { PrismaAnalysisRepository } from '../analysis/prisma-analysis-repository.js';
import { persistAiExplanationFailure, persistAiExplanationSuccess } from '../persist-ai-explanation-result.js';
import { buildValidObservationSet, createAnalysisInAnalyzingState, resetDatabase } from './db-test-helpers.js';
import { persistAnalyzerSuccess } from '../persist-analyzer-result.js';

function sampleResult(): AIExplanationResult {
  return {
    summary: 'A short summary.',
    overallUrgency: { level: 'low', reason: 'Nothing unusual observed.', references: [], limitations: [] },
    findings: [],
    overallNotes: [],
    dataLimitations: [],
  };
}

async function createAnalysisAtAnalyzerResultReady(): Promise<string> {
  const { analysisId } = await createAnalysisInAnalyzingState(prisma);
  const observationSet = await buildValidObservationSet();
  await persistAnalyzerSuccess(prisma, { analysisId, analyzerStatus: 'success', observationSet });
  return analysisId;
}

describe('persistAiExplanationSuccess / persistAiExplanationFailure', () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('persists the AIExplanationRecord and advances Analysis to completed/aiStatus=success', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();

    const { analysis, aiExplanationRecord } = await persistAiExplanationSuccess(prisma, {
      analysisId,
      provider: 'openai',
      model: 'test-model',
      promptVersion: 'initial-explanation-v1',
      schemaVersion: '1.0.0',
      data: sampleResult(),
      providerResponseId: 'resp_1',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });

    expect(analysis.status).toBe('completed');
    expect(analysis.aiStatus).toBe('success');
    expect(aiExplanationRecord.analysisId).toBe(analysisId);
    expect(aiExplanationRecord.providerResponseId).toBe('resp_1');
    expect(aiExplanationRecord.totalTokens).toBe(30);

    const read = await new PrismaAIExplanationRepository(prisma).findByAnalysisId(analysisId);
    expect(read).not.toBeNull();
    expect(read?.data.summary).toBe('A short summary.');
  });

  it('rejects a second AIExplanationRecord for the same analysisId (DB unique constraint)', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();
    await persistAiExplanationSuccess(prisma, {
      analysisId,
      provider: 'openai',
      model: 'test-model',
      promptVersion: 'initial-explanation-v1',
      schemaVersion: '1.0.0',
      data: sampleResult(),
    });

    await expect(
      persistAiExplanationSuccess(prisma, {
        analysisId,
        provider: 'openai',
        model: 'test-model',
        promptVersion: 'initial-explanation-v1',
        schemaVersion: '1.0.0',
        data: sampleResult(),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('AI terminal failure leaves Analysis.status=completed and aiStatus=failed, no AIExplanationRecord', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();

    const analysis = await persistAiExplanationFailure(prisma, { analysisId });

    expect(analysis.status).toBe('completed');
    expect(analysis.aiStatus).toBe('failed');

    const read = await new PrismaAIExplanationRepository(prisma).findByAnalysisId(analysisId);
    expect(read).toBeNull();

    // The Analyzer's own result is untouched by an AI failure.
    const reread = await new PrismaAnalysisRepository(prisma).findById(analysisId);
    expect(reread?.analyzerStatus).toBe('success');
  });
});
