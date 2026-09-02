import { PrismaAnalysisRepository, PrismaObservationSetRepository, type prisma } from '@polaris/db';
import { enqueueAnalyzerJob } from '@polaris/queue';
import type { Queue } from 'bullmq';
import type { AnalyzerJobData } from '@polaris/queue';

/**
 * A real recovery path for md/34 §26's "enqueue failure -> Analysis stays
 * uploaded, recoverable" — not just "the enqueue call happens to be
 * idempotent" (35_Sprint_4_Plan_Review.md F-10). No public HTTP endpoint is
 * required; this is exercised directly (T-18).
 */
export async function recoverAnalyzerEnqueue(
  analysisId: string,
  deps: { prisma: typeof prisma; analyzerQueue: Queue<AnalyzerJobData> },
): Promise<'enqueued' | 'skipped'> {
  const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
  if (analysis === null || analysis.status !== 'uploaded') return 'skipped';

  const existingObservationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
  if (existingObservationSet !== null) return 'skipped';

  await enqueueAnalyzerJob(deps.analyzerQueue, analysisId);
  return 'enqueued';
}
