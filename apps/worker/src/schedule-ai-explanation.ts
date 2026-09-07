import { PrismaAnalysisRepository } from '@polaris/db';
import { recoverAiExplanationEnqueue } from '@polaris/queue';
import type { WorkerDeps } from './deps.js';

/**
 * The orchestration function the Analyzer Handler calls right after
 * `persistAnalyzerSuccess()` succeeds — the only thing that ever enqueues
 * the initial AI Explanation Job (44_Development_Setup_and_Sixth_Sprint.md
 * §53/§86). Never throws (same contract as `reconcileRawLogDeletion`) — an
 * AI-scheduling failure must never turn a successful Analyzer job into a
 * failure (§54).
 *
 * `already_queued` is *not* treated as "DB already consistent"
 * (46_Sprint_6_Plan_Final_Review.md F-05/M-01): `recoverAiExplanationEnqueue()`
 * can legitimately return it while `Analysis.aiStatus` is still stuck at
 * `not_requested` from an earlier failed reconciliation attempt — this is
 * exactly where that drift gets corrected.
 */
export async function scheduleInitialAiExplanation(analysisId: string, deps: WorkerDeps): Promise<void> {
  try {
    const result = await recoverAiExplanationEnqueue(analysisId, deps);
    if (result === 'enqueued' || result === 'retried' || result === 'already_queued') {
      // Same-status update — the WHERE clause still requires the row to
      // currently be at 'analyzer_result_ready'; assertValidAnalysisStatusTransition
      // short-circuits on from===to, so this only ever (re-)writes aiStatus,
      // never the top-level status. If the Worker has already claimed the
      // job and moved status to 'explaining', this CAS's WHERE clause
      // simply matches zero rows — a harmless no-op, not an error.
      await new PrismaAnalysisRepository(deps.prisma).compareAndSetStatus(
        analysisId,
        'analyzer_result_ready',
        'analyzer_result_ready',
        { aiStatus: 'queued' },
      );
    }
    // already_running: deliberately NOT written here. The Worker's own
    // claim CAS (analyzer_result_ready|completed -> explaining, aiStatus:
    // running) is the sole writer of that transition; a second, non-atomic
    // write from this orchestration function racing against it could stomp
    // a legitimate concurrent state change. The gap between "Queue says
    // active" and "DB visibly shows explaining/running" is an accepted,
    // momentary race the Worker's own claim resolves immediately after.
    //
    // already_completed: persistAiExplanationSuccess's own transaction
    // already set aiStatus=success as part of the same commit that created
    // the AIExplanationRecord — nothing further to reconcile.
    //
    // finalized_as_failed (48_Sprint_6_Final_ReReview.md M-02): unreachable
    // from this call site in practice (a brand-new Analysis can't already
    // have a terminal BullMQ job), but if it ever were reached,
    // recoverAiExplanationEnqueue() already persisted the terminal failure
    // directly — writing aiStatus=queued over that would be wrong.
  } catch {
    // Never turn a successful Analyzer job into a failure (§54).
  }
}
