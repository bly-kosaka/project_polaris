import type { Analysis, AnalysisMetadata } from '@polaris/domain';
import { validateObservationSet, type ObservationSet } from '@polaris/analyzer';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaAnalysisRepository } from './analysis/prisma-analysis-repository.js';
import { PrismaObservationSetRepository } from './observation-set/prisma-observation-set-repository.js';
import type { ObservationSetRecord } from './observation-set/types.js';

/**
 * Two separate functions, not one branched function — keeps
 * persistAnalyzerFailure structurally incapable of importing
 * ObservationSetRepository at all, so "a failed analysis can never get an
 * ObservationSetRecord" can't be violated by editing a branch (32 review,
 * Critical-candidate: "failed AnalyzerでObservationSet保存").
 */
export async function persistAnalyzerSuccess(
  prisma: PrismaClient,
  params: {
    analysisId: string;
    analyzerStatus: 'success' | 'partial';
    observationSet: ObservationSet;
    metadata?: Partial<AnalysisMetadata>;
  },
): Promise<{ analysis: Analysis; observationSetRecord: ObservationSetRecord }> {
  validateObservationSet(params.observationSet);
  return prisma.$transaction(async (tx) => {
    const observationSetRecord = await new PrismaObservationSetRepository(tx).create({
      analysisId: params.analysisId,
      schemaVersion: params.observationSet.schemaVersion,
      data: params.observationSet,
    });
    const analysis = await new PrismaAnalysisRepository(tx).updateStatus(params.analysisId, 'analyzer_result_ready', {
      analyzerStatus: params.analyzerStatus,
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    });
    return { analysis, observationSetRecord };
  });
}

export async function persistAnalyzerFailure(
  prisma: PrismaClient,
  params: { analysisId: string },
): Promise<Analysis> {
  return new PrismaAnalysisRepository(prisma).updateStatus(params.analysisId, 'failed', { analyzerStatus: 'failed' });
}
