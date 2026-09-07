import type { Job, Queue } from 'bullmq';
import {
  buildAiExplanationJobId,
  buildAnalyzerJobId,
  buildCleanupJobId,
  buildRawLogDeleteJobId,
  CLEANUP_JOB,
  RAW_LOG_DELETE_JOB,
} from './job-types.js';
import type { AIExplanationJobData, AnalyzerJobData, CleanupExpiredRawLogsJobData, RawLogDeleteJobData } from './job-types.js';

/**
 * Numbers are pre-benchmark placeholders (34_Development_Setup_and_Fourth_Sprint.md §43).
 */
const ANALYZER_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export async function enqueueAnalyzerJob(queue: Queue<AnalyzerJobData>, analysisId: string): Promise<Job<AnalyzerJobData>> {
  return queue.add('analyzer', { analysisId }, { ...ANALYZER_JOB_OPTIONS, jobId: buildAnalyzerJobId(analysisId) });
}

/**
 * Numbers are pre-benchmark placeholders, same convention as
 * ANALYZER_JOB_OPTIONS (44_Development_Setup_and_Sixth_Sprint.md §52).
 */
const AI_EXPLANATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export async function enqueueAiExplanationJob(
  queue: Queue<AIExplanationJobData>,
  analysisId: string,
): Promise<Job<AIExplanationJobData>> {
  return queue.add(
    'ai-explanation',
    { analysisId },
    { ...AI_EXPLANATION_JOB_OPTIONS, jobId: buildAiExplanationJobId(analysisId) },
  );
}

export async function enqueueRawLogDeleteJob(
  queue: Queue<RawLogDeleteJobData>,
  analysisId: string,
): Promise<Job<RawLogDeleteJobData>> {
  return queue.add(
    RAW_LOG_DELETE_JOB,
    { analysisId },
    { attempts: 5, backoff: { type: 'exponential', delay: 10000 }, jobId: buildRawLogDeleteJobId(analysisId) },
  );
}

/**
 * `timeBucket` collapses to an hourly bucket by default so repeated
 * scheduling doesn't pile up duplicate cleanup jobs for the same window.
 */
export async function enqueueCleanupJob(
  queue: Queue<CleanupExpiredRawLogsJobData>,
  scheduledAt: Date = new Date(),
): Promise<Job<CleanupExpiredRawLogsJobData>> {
  const timeBucket = scheduledAt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return queue.add(
    CLEANUP_JOB,
    { scheduledAt: scheduledAt.toISOString() },
    { attempts: 3, jobId: buildCleanupJobId(timeBucket) },
  );
}

const CLEANUP_SCHEDULER_ID = 'cleanup-expired-raw-logs-scheduler';

/**
 * Registers a repeatable Cleanup Job so the 24h Retention safety net
 * actually fires without anything else having to remember to enqueue it —
 * `enqueueCleanupJob()` existing was not enough on its own
 * (36_Sprint_4_Review.md M-02). `upsertJobScheduler` is idempotent by
 * `jobSchedulerId`, so calling this on every Worker startup never creates
 * duplicate schedulers. `scheduledAt` in the generated jobs' payload is
 * informational only — `handleCleanupJob` queries `expiresAt < now()`
 * against the real clock at run time, never trusting the Queue as a time
 * source (Queue is not the Source of Truth, 34_Development_Setup_and_Fourth_Sprint.md §6).
 */
export async function registerCleanupScheduler(
  queue: Queue<CleanupExpiredRawLogsJobData>,
  everyMs = 60 * 60 * 1000,
): Promise<void> {
  await queue.upsertJobScheduler(
    CLEANUP_SCHEDULER_ID,
    { every: everyMs },
    { name: CLEANUP_JOB, data: { scheduledAt: new Date(0).toISOString() } },
  );
}
