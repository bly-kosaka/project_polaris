import type { Job } from 'bullmq';
import { PrismaUploadedAccessLogRepository } from '@polaris/db';
import type { RawLogDeleteJobData } from '@polaris/queue';
import type { WorkerDeps } from './deps.js';

/**
 * DB re-source-of-truth for storageKey (never trusts the Queue payload for
 * it — 34_Development_Setup_and_Fourth_Sprint.md §12). Delete is idempotent:
 * a key that's already gone is treated as success, both at the Storage
 * layer (packages/storage's deleteObject) and here (an already-deleted row
 * is a no-op, not an error).
 */
export async function handleRawLogDeleteJob(job: Job<RawLogDeleteJobData>, deps: WorkerDeps): Promise<void> {
  const { analysisId } = job.data;
  const repository = new PrismaUploadedAccessLogRepository(deps.prisma);

  const uploadedAccessLog = await repository.findByAnalysisId(analysisId);
  if (uploadedAccessLog === null) return;
  if (uploadedAccessLog.status === 'deleted' || uploadedAccessLog.status === 'expired') return;

  try {
    await deps.storage.deleteObject(uploadedAccessLog.storageKey);
  } catch (error) {
    await repository.markDeletionFailed(analysisId);
    throw error; // BullMQ retries this job per its own attempts/backoff
  }
  await repository.markDeletionSuccess(analysisId, { reason: 'normal' });
}
