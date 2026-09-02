import type { Job, Queue } from 'bullmq';
import { buildAnalyzerJobId, buildCleanupJobId, buildRawLogDeleteJobId, CLEANUP_JOB, RAW_LOG_DELETE_JOB } from './job-types.js';
import type { AnalyzerJobData, CleanupExpiredRawLogsJobData, RawLogDeleteJobData } from './job-types.js';

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
