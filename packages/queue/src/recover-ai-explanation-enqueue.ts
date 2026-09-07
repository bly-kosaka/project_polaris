import { PrismaAIExplanationRepository, PrismaAnalysisRepository, persistAiExplanationFailure, type prisma } from '@polaris/db';
import type { Queue } from 'bullmq';
import { buildAiExplanationJobId } from './job-types.js';
import { enqueueAiExplanationJob } from './enqueue.js';
import type { AIExplanationJobData } from './job-types.js';

/**
 * `PostgreSQL Analysis`/`AIExplanationRecord` = Product Lifecycle Source of
 * Truth; BullMQ = execution mechanism only
 * (44_Development_Setup_and_Sixth_Sprint.md, 45_Sprint_6_Plan_Review.md
 * M-03). This function inspects *only* BullMQ job state plus whether an
 * `AIExplanationRecord` already exists — it never itself writes
 * `Analysis.aiStatus`. The caller (Worker's `scheduleInitialAiExplanation`,
 * or the API's Retry route) decides what, if anything, to reconcile in
 * Postgres based on the result — and must NOT assume `already_queued`
 * means the DB is already consistent
 * (46_Sprint_6_Plan_Final_Review.md M-01/F-05): a prior enqueue attempt's
 * DB write can fail even after the BullMQ job itself landed.
 */
export type RecoverAiExplanationResult =
  | 'enqueued'
  | 'retried'
  | 'already_queued'
  | 'already_running'
  | 'already_completed'
  | 'finalized_as_failed';

export async function recoverAiExplanationEnqueue(
  analysisId: string,
  deps: { prisma: typeof prisma; aiExplanationQueue: Queue<AIExplanationJobData> },
): Promise<RecoverAiExplanationResult> {
  const existingRecord = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
  if (existingRecord !== null) return 'already_completed';

  const jobId = buildAiExplanationJobId(analysisId);
  const existingJob = await deps.aiExplanationQueue.getJob(jobId);
  if (existingJob !== undefined) {
    const state = await existingJob.getState();
    if (state === 'failed' || state === 'completed') {
      // 48_Sprint_6_Final_ReReview.md M-02: a BullMQ-terminal job with no
      // AIExplanationRecord AND Analysis.aiStatus still 'running' means the
      // Job Handler's own terminal-failure persist (persistAiExplanationFailure)
      // itself failed on what was already the last attempt — Analysis.status/
      // .aiStatus never committed even though the Provider attempts were
      // genuinely exhausted (BullMQ = failed, PostgreSQL = explaining/running).
      // Finalize directly to completed/failed rather than granting a bonus
      // attempt cycle the configured `attempts` never promised, and rather
      // than leaving the two systems permanently inconsistent.
      const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
      if (analysis?.aiStatus === 'running') {
        await persistAiExplanationFailure(deps.prisma, { analysisId });
        return 'finalized_as_failed';
      }
      await existingJob.retry(state);
      return 'retried';
    }
    if (state === 'active') return 'already_running';
    return 'already_queued'; // waiting / delayed
  }

  await enqueueAiExplanationJob(deps.aiExplanationQueue, analysisId);
  return 'enqueued';
}
