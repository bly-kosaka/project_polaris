import { PrismaAnalysisRepository, PrismaObservationSetRepository, type prisma } from '@polaris/db';
import type { Queue } from 'bullmq';
import { buildAnalyzerJobId } from './job-types.js';
import { enqueueAnalyzerJob } from './enqueue.js';
import type { AnalyzerJobData } from './job-types.js';

/**
 * A real recovery path for md/34 §26's "enqueue failure -> Analysis stays
 * uploaded, recoverable" — not just "the enqueue call happens to be
 * idempotent" (35_Sprint_4_Plan_Review.md F-10). No public HTTP endpoint is
 * required; this is exercised directly (T-18).
 *
 * Lives in packages/queue rather than apps/api: it depends only on
 * @polaris/db + a Queue instance (no Fastify/HTTP concerns), and
 * apps/worker's own integration tests need to call this same production
 * function to prove the full preflight-failure -> recovery -> success loop
 * (36_Sprint_4_Review.md M-01R/S4-FIX-10) without pulling in apps/api as a
 * dependency (importing apps/api's own index.ts would trigger its process
 * bootstrap as a side effect).
 */
export async function recoverAnalyzerEnqueue(
  analysisId: string,
  deps: { prisma: typeof prisma; analyzerQueue: Queue<AnalyzerJobData> },
): Promise<'enqueued' | 'retried' | 'skipped'> {
  const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
  if (analysis === null || analysis.status !== 'uploaded') return 'skipped';

  const existingObservationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
  if (existingObservationSet !== null) return 'skipped';

  // A job in the `completed` or `failed` set still counts as a duplicate to
  // BullMQ — add() with the same custom jobId is silently ignored (no
  // error, no new job) as long as that finished job hasn't been removed
  // (36_Sprint_4_Review.md M-01R, confirmed against BullMQ's own docs on
  // job-id deduplication). A plain enqueueAnalyzerJob() call in that
  // situation would report success while doing nothing.
  const jobId = buildAnalyzerJobId(analysisId);
  const existingJob = await deps.analyzerQueue.getJob(jobId);
  if (existingJob !== undefined) {
    const state = await existingJob.getState();
    if (state === 'failed' || state === 'completed') {
      await existingJob.retry(state);
      return 'retried';
    }
    return 'skipped'; // waiting / active / delayed — already in flight, nothing to do
  }

  await enqueueAnalyzerJob(deps.analyzerQueue, analysisId);
  return 'enqueued';
}
