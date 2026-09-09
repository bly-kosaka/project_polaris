import type { Analysis, AnalysisMetadata } from '@polaris/domain';
import { validateObservationSet, type ObservationSet } from '@polaris/analyzer';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaAnalysisRepository } from './analysis/prisma-analysis-repository.js';
import { PrismaObservationSetRepository } from './observation-set/prisma-observation-set-repository.js';
import type { ObservationSetRecord } from './observation-set/types.js';
import { PrismaUsageEventRepository } from './usage-event/prisma-usage-event-repository.js';

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

    // Usage Accounting (57_Development_Setup_and_Eighth_Sprint.md §38-41):
    // resolved here, inside the SAME transaction as the ObservationSet
    // write, from Analysis alone — the Worker never passes an accountId in,
    // staying 100% Billing-unaware. No CONFLICT catch-and-ignore needed:
    // the Worker's own Step-1 idempotency guard (checked before this
    // function is ever called) already prevents a legitimate second call
    // for the same analysisId, and ObservationSetRecord.analysisId @unique
    // would throw on the write immediately above this one before a
    // duplicate UsageEvent insert could ever be attempted.
    const owner = await tx.analysis.findUniqueOrThrow({
      where: { id: params.analysisId },
      select: { project: { select: { ownerAccountId: true } } },
    });
    await new PrismaUsageEventRepository(tx).create({
      accountId: owner.project.ownerAccountId,
      analysisId: params.analysisId,
      metric: 'analysis_completed',
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
