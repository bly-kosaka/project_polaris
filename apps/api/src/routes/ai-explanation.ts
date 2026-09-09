import { PrismaAIExplanationRepository, PrismaAnalysisRepository, PrismaObservationSetRepository } from '@polaris/db';
import { recoverAiExplanationEnqueue } from '@polaris/queue';
import type { FastifyInstance } from 'fastify';
import { requireOwnedAnalysis } from '../auth/require-owned-analysis.js';
import { requireEntitlement } from '../billing/require-entitlement.js';
import type { ApiDeps } from '../deps.js';
import { toAIExplanationDetailDto } from '../dto/ai-explanation.js';
import { sendApiError } from '../errors.js';

/**
 * Kept separate from routes/analyses.ts rather than growing that file
 * further (44_Development_Setup_and_Sixth_Sprint.md decision 9).
 */
export function registerAiExplanationRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get<{ Params: { analysisId: string } }>('/analyses/:analysisId/explanation', async (req, reply) => {
    const { analysisId } = req.params;
    const analysis = await requireOwnedAnalysis(deps, req, reply, analysisId);
    if (analysis === undefined) return;
    if (analysis.aiStatus === 'failed') {
      return sendApiError(reply, 409, 'AI_EXPLANATION_FAILED', 'AI Explanation failed for this Analysis');
    }

    const record = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    if (record === null) {
      // Covers not_requested / queued / running — aiStatus itself is only
      // ever observable via GET /analyses/:analysisId, never this endpoint
      // (46_Sprint_6_Plan_Final_Review.md F-07).
      return sendApiError(reply, 404, 'AI_EXPLANATION_NOT_READY', 'AI Explanation is not ready yet');
    }
    return reply.send(toAIExplanationDetailDto(record));
  });

  app.post<{ Params: { analysisId: string } }>('/analyses/:analysisId/explanation/retry', async (req, reply) => {
    const { analysisId } = req.params;
    const analysisRepository = new PrismaAnalysisRepository(deps.prisma);

    const analysis = await requireOwnedAnalysis(deps, req, reply, analysisId);
    if (analysis === undefined) return;

    // Entitlement is an authorization-tier gate like Ownership, not a
    // business-state check (57_Development_Setup_and_Eighth_Sprint.md plan
    // decision 7) — a Free caller gets a consistent 403 regardless of the
    // Analysis's lifecycle stage, never leaking business-state info (e.g.
    // whether an AIExplanationRecord already exists) to a caller who has no
    // right to retry regardless. Ownership (404) has already run above.
    if ((await requireEntitlement(deps, req, reply, 'aiExplanationRetry')) === undefined) return;

    const observationSetRecord = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    const analyzerReady = analysis.analyzerStatus === 'success' || analysis.analyzerStatus === 'partial';
    if (observationSetRecord === null || !analyzerReady) {
      return sendApiError(reply, 409, 'OBSERVATION_SET_NOT_READY', 'The ObservationSet is not ready yet');
    }

    const existingRecord = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    if (existingRecord !== null) {
      // Sprint 6 never regenerates a success (§63) — an existing record
      // means an earlier recoverAiExplanationEnqueue call would report
      // 'already_completed' anyway, but this check runs first so the
      // response is unambiguous even under the race the comment below
      // describes.
      return sendApiError(reply, 409, 'AI_EXPLANATION_ALREADY_EXISTS', 'An AI Explanation already exists for this Analysis');
    }

    const result = await recoverAiExplanationEnqueue(analysisId, deps);
    if (result === 'enqueued' || result === 'retried' || result === 'already_queued') {
      // Same-status CAS anchored on the Analysis's OWN current status — not
      // hardcoded to 'completed' (48_Sprint_6_Final_ReReview.md M-01). This
      // endpoint must recover two distinct cases with the same call: a
      // post-terminal-failure retry (status already 'completed') AND an
      // initial AI enqueue that never even succeeded once (aiStatus stuck at
      // 'not_requested', status still 'analyzer_result_ready' — a hardcoded
      // 'completed' anchor silently no-ops on this case, since the CAS's
      // WHERE clause never matches a row still at 'analyzer_result_ready').
      // A no-op is still correct if the Analysis has moved on since the read
      // above (e.g. the Worker's own claim already advanced it) — the CAS's
      // WHERE clause simply matches zero rows.
      await analysisRepository.compareAndSetStatus(analysisId, analysis.status, analysis.status, { aiStatus: 'queued' });
    }
    // already_running: the Worker's own claim CAS is the sole writer of
    // that transition (decision 7a's reasoning, mirrored here).
    // already_completed: an AIExplanationRecord appeared between the check
    // above and this call — a benign race, reported rather than erroring
    // (its own transaction already reconciled aiStatus=success).
    // finalized_as_failed (M-02): recoverAiExplanationEnqueue itself already
    // persisted the terminal failure directly — writing aiStatus=queued over
    // that would be wrong, so this deliberately falls through to no write.

    return reply.send({ status: result });
  });
}
