import type { Job } from 'bullmq';
import { PrismaUploadedAccessLogRepository } from '@polaris/db';
import type { CleanupExpiredRawLogsJobData } from '@polaris/queue';
import type { WorkerDeps } from './deps.js';

/**
 * Retention safety net (34_Development_Setup_and_Fourth_Sprint.md §38-39):
 * only rows past `expiresAt` that the normal lifecycle hasn't already
 * cleaned up. Deliberately does not infer anything from Analysis/
 * ObservationSet state — a Raw Log mid-Retry (Analyzer still legitimately
 * needs it) is left alone until it actually crosses `expiresAt`.
 */
export async function handleCleanupJob(_job: Job<CleanupExpiredRawLogsJobData>, deps: WorkerDeps): Promise<void> {
  const repository = new PrismaUploadedAccessLogRepository(deps.prisma);
  const candidates = await repository.findExpiredCandidates(new Date());

  for (const candidate of candidates) {
    try {
      await deps.storage.deleteObject(candidate.storageKey);
      await repository.markDeletionSuccess(candidate.analysisId, { reason: 'expired' }); // T-23
    } catch {
      await repository.markDeletionFailed(candidate.analysisId);
      // Left for the next Cleanup run — no per-row rethrow, so one failure
      // doesn't abort the sweep for the rest of the batch.
    }
  }
}
