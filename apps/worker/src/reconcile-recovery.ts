import {
  PrismaAnalysisExecutionRepository,
  PrismaAnalysisRepository,
  PrismaUploadedAccessLogRepository,
} from '@polaris/db';
import { enqueueRawLogDeleteJob } from '@polaris/queue';
import type { WorkerDeps } from './deps.js';

/**
 * Attempts the Raw Log delete for an Analysis and records the outcome —
 * used both by the main flow (right after persistAnalyzerSuccess/Failure
 * commits) and by the Crash-after-Persist recovery branch. Deliberately
 * never imports persistAnalyzerSuccess/persistAnalyzerFailure itself, so it
 * is structurally incapable of re-persisting an ObservationSet no matter
 * which caller reaches it (35_Sprint_4_Plan_Review.md F-03). Idempotent:
 * no-ops if there's no UploadedAccessLog row, or it's already
 * deleted/expired.
 */
export async function reconcileRawLogDeletion(analysisId: string, deps: WorkerDeps): Promise<void> {
  const uploadedAccessLogRepository = new PrismaUploadedAccessLogRepository(deps.prisma);
  const uploadedAccessLog = await uploadedAccessLogRepository.findByAnalysisId(analysisId);
  if (uploadedAccessLog === null) return;
  if (uploadedAccessLog.status === 'deleted' || uploadedAccessLog.status === 'expired') return;

  try {
    await deps.storage.deleteObject(uploadedAccessLog.storageKey);
    await uploadedAccessLogRepository.markDeletionSuccess(analysisId, { reason: 'normal' });
  } catch {
    // Delete is retried via the maintenance queue, not by rethrowing here —
    // a delete failure must never turn into an Analyzer-job failure/retry
    // (34_Development_Setup_and_Fourth_Sprint.md §36).
    await uploadedAccessLogRepository.markDeletionFailed(analysisId);
    await enqueueRawLogDeleteJob(deps.maintenanceQueue, analysisId); // F-09
  }
}

export async function reconcileExecutionAfterPersist(analysisId: string, deps: WorkerDeps): Promise<void> {
  const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
  const executionRepository = new PrismaAnalysisExecutionRepository(deps.prisma);

  const execution = await executionRepository.findByAnalysisIdAndType(analysisId, 'analyzer');
  if (execution === null) return;
  if (execution.status === 'success' || execution.status === 'partial') return;

  const analysis = await analysisRepository.findById(analysisId);
  const analyzerStatus = analysis?.analyzerStatus;
  if (analyzerStatus !== 'success' && analyzerStatus !== 'partial') return;

  await executionRepository.updateProgress(analysisId, 'analyzer', {
    status: analyzerStatus,
    completedAt: new Date().toISOString(),
  });
}
