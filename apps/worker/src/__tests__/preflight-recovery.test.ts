import {
  PrismaAnalysisRepository,
  PrismaObservationSetRepository,
  PrismaUploadedAccessLogRepository,
} from '@polaris/db';
import { createAnalyzerQueue, recoverAnalyzerEnqueue } from '@polaris/queue';
import { describe, expect, it } from 'vitest';
import type { WorkerDeps } from '../deps.js';
import { runAnalyzerJobToSettlement } from './bullmq-test-helpers.js';
import { withFailingObservationSetLookup } from './prisma-fault-injection.js';
import { buildWorkerDeps, resetDatabase, setUpUploadedAnalysis } from './worker-test-helpers.js';

/**
 * S4-FIX-10 / M-01R (36_Sprint_4_Review.md): the ObservationSet-existence
 * preflight at the very top of handleAnalyzerJob sits outside the
 * classify/retry-exhaustion boundary on purpose (finalizing as `failed`
 * there would be unsafe — if the lookup itself is what's failing, we can't
 * actually tell whether an ObservationSet already exists). BullMQ still
 * retries a preflight failure via its own default mechanism, but at true
 * exhaustion the job lands in `failed` with the DB left exactly as it was
 * (Analysis stays `uploaded`, Raw Log untouched) — recoverable, but only if
 * something actually re-queues it. `recoverAnalyzerEnqueue()` (moved to
 * @polaris/queue) is that something; this proves the full loop end to end.
 */
describe('preflight recovery (M-01R)', () => {
  it('a preflight failure that exhausts retries can be recovered and then completes for real', async () => {
    await resetDatabase();
    const deps = await buildWorkerDeps();
    try {
      const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');

      const depsWithFailingLookup: WorkerDeps = {
        ...deps,
        prisma: withFailingObservationSetLookup(
          deps.prisma,
          Infinity,
          'simulated permanent ObservationSet lookup failure',
        ),
      };

      const state = await runAnalyzerJobToSettlement(depsWithFailingLookup, deps.connection, analysisId, {
        attempts: 2,
        backoffMs: 100,
      });
      expect(state).toBe('failed'); // BullMQ gives up — but nothing wrote a false DB state

      const stuckAnalysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
      expect(stuckAnalysis?.status).toBe('uploaded'); // untouched, not falsely marked failed
      const stuckObservationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
      expect(stuckObservationSet).toBeNull();
      const stuckUpload = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
      expect(stuckUpload?.status).toBe('uploaded'); // Raw Log never touched by the preflight failure

      // A plain enqueueAnalyzerJob() would silently no-op against the
      // existing failed job's deterministic id — recoverAnalyzerEnqueue
      // must detect and actually requeue it (M-01R).
      const analyzerQueue = createAnalyzerQueue(deps.connection);
      const outcome = await recoverAnalyzerEnqueue(analysisId, { prisma: deps.prisma, analyzerQueue });
      expect(outcome).toBe('retried');
      await analyzerQueue.close();

      // Real processing this time (unfaulty deps) — proves the recovered
      // job actually completes, not just that its BullMQ state changed.
      const finalState = await runAnalyzerJobToSettlement(deps, deps.connection, analysisId, { attempts: 3 });
      expect(finalState).toBe('completed');

      const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
      expect(analysis?.status).toBe('analyzer_result_ready');
      const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
      expect(observationSet).not.toBeNull();
    } finally {
      await deps.close();
    }
  }, 30000);
});
