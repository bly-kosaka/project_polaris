import { PrismaAIExplanationRepository, PrismaAnalysisRepository, PrismaObservationSetRepository } from '@polaris/db';
import { recoverAiExplanationEnqueue } from '@polaris/queue';
import type { FastifyInstance } from 'fastify';
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
    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    if (analysis === null) {
      return sendApiError(reply, 404, 'ANALYSIS_NOT_FOUND', 'Analysis not found');
    }
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

    const analysis = await analysisRepository.findById(analysisId);
    if (analysis === null) {
      return sendApiError(reply, 404, 'ANALYSIS_NOT_FOUND', 'Analysis not found');
    }

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
      // Same-status CAS anchored on 'completed' (decision 9) — a no-op if
      // the Analysis is actually still mid-flight (e.g. status is still
      // 'analyzer_result_ready'/'explaining' from a still-running initial
      // attempt), correcting Queue/DB drift rather than assuming
      // 'already_queued' already implies a consistent DB row (F-05).
      await analysisRepository.compareAndSetStatus(analysisId, 'completed', 'completed', { aiStatus: 'queued' });
    }
    // already_running: the Worker's own claim CAS is the sole writer of
    // that transition (decision 7a's reasoning, mirrored here).
    // already_completed: an AIExplanationRecord appeared between the check
    // above and this call — a benign race, reported rather than erroring
    // (its own transaction already reconciled aiStatus=success).

    return reply.send({ status: result });
  });
}
