export interface AnalyzerJobData {
  analysisId: string;
}

export interface RawLogDeleteJobData {
  analysisId: string;
}

export interface CleanupExpiredRawLogsJobData {
  scheduledAt: string;
}

export interface AIExplanationJobData {
  analysisId: string;
}

export const RAW_LOG_DELETE_JOB = 'raw-log-delete';
export const CLEANUP_JOB = 'cleanup-expired-raw-logs';

/**
 * BullMQ custom Job IDs must not contain `:` (reserved as a Redis key
 * separator internally) and must not be strings of digits only — confirmed
 * against docs.bullmq.io/guide/jobs/job-ids (35_Sprint_4_Plan_Review.md F-01).
 * Deterministic per analysisId so a duplicate enqueue collapses to one job.
 */
export function buildAnalyzerJobId(analysisId: string): string {
  return `analyzer-${analysisId}`;
}

export function buildRawLogDeleteJobId(analysisId: string): string {
  return `raw-log-delete-${analysisId}`;
}

export function buildAiExplanationJobId(analysisId: string): string {
  return `ai-explanation-${analysisId}`;
}

export function buildCleanupJobId(timeBucket: string): string {
  return `cleanup-${timeBucket}`;
}
