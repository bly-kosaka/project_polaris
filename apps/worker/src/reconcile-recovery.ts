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
 *
 * Never throws — every caller has *already* committed a successful (or
 * fatal-but-persisted) Analyzer result by the time this runs, and a Raw Log
 * delete reconciliation problem must never cascade into that being treated
 * as an Analyzer-job failure (34_Development_Setup_and_Fourth_Sprint.md §36,
 * 36_Sprint_4_Review.md M-03). Left for the next retry/recovery pass or the
 * periodic Cleanup sweep if even the enqueue below fails.
 */
export async function reconcileRawLogDeletion(analysisId: string, deps: WorkerDeps): Promise<void> {
  const uploadedAccessLogRepository = new PrismaUploadedAccessLogRepository(deps.prisma);
  try {
    const uploadedAccessLog = await uploadedAccessLogRepository.findByAnalysisId(analysisId);
    if (uploadedAccessLog === null) return;
    if (uploadedAccessLog.status === 'deleted' || uploadedAccessLog.status === 'expired') return;

    try {
      await deps.storage.deleteObject(uploadedAccessLog.storageKey);
      await uploadedAccessLogRepository.markDeletionSuccess(analysisId, { reason: 'normal' });
    } catch {
      // Delete is retried via the maintenance queue, not by rethrowing here —
      // a delete failure must never turn into an Analyzer-job failure/retry.
      await uploadedAccessLogRepository.markDeletionFailed(analysisId);
      try {
        await enqueueRawLogDeleteJob(deps.maintenanceQueue, analysisId); // F-09
      } catch {
        // The enqueue call itself failing must also stay isolated — an
        // unavailable Maintenance queue is not an Analyzer-job failure
        // either (36_Sprint_4_Review.md M-03). deletionStatus stays
        // 'failed'; the periodic Cleanup sweep is the backstop.
      }
    }
  } catch {
    // Covers failures before the inner try (e.g. findByAnalysisId itself)
    // with the same never-throw contract.
  }
}

/**
 * Also never throws, for the same reason as reconcileRawLogDeletion — this
 * only updates observability metadata (AnalysisExecution) after a result
 * that's already durably persisted.
 */
export async function reconcileExecutionAfterPersist(analysisId: string, deps: WorkerDeps): Promise<void> {
  try {
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
  } catch {
    // Best-effort metadata reconciliation — left for the next pass.
  }
}
