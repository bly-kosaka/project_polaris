import type { AIExplanationResult } from '@polaris/ai';
import type { Analysis } from '@polaris/domain';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaAIExplanationRepository } from './ai-explanation/prisma-ai-explanation-repository.js';
import type { AIExplanationRecord } from './ai-explanation/types.js';
import { PrismaAnalysisRepository } from './analysis/prisma-analysis-repository.js';

/**
 * The Lifecycle commit point (44_Development_Setup_and_Sixth_Sprint.md
 * §92): `aiStatus` never becomes `'success'` until the AIExplanationRecord
 * itself is durably persisted, in the same transaction.
 */
export async function persistAiExplanationSuccess(
  prisma: PrismaClient,
  params: {
    analysisId: string;
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    data: AIExplanationResult;
    providerResponseId?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  },
): Promise<{ analysis: Analysis; aiExplanationRecord: AIExplanationRecord }> {
  return prisma.$transaction(async (tx) => {
    const aiExplanationRecord = await new PrismaAIExplanationRepository(tx).create({
      analysisId: params.analysisId,
      provider: params.provider,
      model: params.model,
      promptVersion: params.promptVersion,
      schemaVersion: params.schemaVersion,
      data: params.data,
      ...(params.providerResponseId !== undefined ? { providerResponseId: params.providerResponseId } : {}),
      ...(params.inputTokens !== undefined ? { inputTokens: params.inputTokens } : {}),
      ...(params.outputTokens !== undefined ? { outputTokens: params.outputTokens } : {}),
      ...(params.totalTokens !== undefined ? { totalTokens: params.totalTokens } : {}),
    });
    const analysis = await new PrismaAnalysisRepository(tx).updateStatus(params.analysisId, 'completed', {
      aiStatus: 'success',
    });
    return { analysis, aiExplanationRecord };
  });
}

/**
 * AI terminal failure — `Analysis.status` becomes `'completed'`, never
 * `'failed'` (§8/§93/A6-13). The Analyzer's own result and ObservationSet
 * are untouched.
 */
export async function persistAiExplanationFailure(prisma: PrismaClient, params: { analysisId: string }): Promise<Analysis> {
  return new PrismaAnalysisRepository(prisma).updateStatus(params.analysisId, 'completed', { aiStatus: 'failed' });
}
