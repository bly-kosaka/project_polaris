import { AIProviderError } from '@polaris/ai';
import { PrismaAIExplanationRepository, PrismaAnalysisRepository } from '@polaris/db';
import { buildAiExplanationJobId, recoverAiExplanationEnqueue } from '@polaris/queue';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleAiExplanationJob } from '../ai-explanation-job-handler.js';
import { FakeAIProvider } from './fake-ai-provider.js';
import { buildWorkerDeps, fakeAiExplanationJob, resetDatabase, setUpAnalysisReadyForAiExplanation } from './worker-test-helpers.js';

/**
 * T-AI-03/T-AI-04 (46_Sprint_6_Plan_Final_Review.md) — the full Retry
 * lifecycle, once via the same reconciliation primitives the API's Retry
 * route uses (decision 9), and once via a genuine in-flight BullMQ retry
 * (no separate Retry-API trigger at all).
 */
describe('AI Explanation retry lifecycle', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('T-AI-03: failed -> (API-equivalent) retry -> queued/completed -> Worker claim -> explaining/running -> success -> completed/success', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const analysisRepository = new PrismaAnalysisRepository(deps.prisma);

    // Reach a terminal AI failure first — a non-retryable Provider error
    // fails immediately, without waiting for attempts to exhaust.
    const failingDeps = {
      ...deps,
      aiProvider: new FakeAIProvider({ failWith: new AIProviderError('AI_PROVIDER_INVALID_REQUEST', 'boom') }),
    };
    await expect(handleAiExplanationJob(fakeAiExplanationJob(analysisId), failingDeps)).rejects.toThrow();

    const afterFailure = await analysisRepository.findById(analysisId);
    expect(afterFailure?.status).toBe('completed');
    expect(afterFailure?.aiStatus).toBe('failed');

    // setUpAnalysisReadyForAiExplanation already ran scheduleInitialAiExplanation
    // as part of the real Analyzer pipeline, landing a real BullMQ job that this
    // test's direct handleAiExplanationJob() call above never touched (tests call
    // the handler directly rather than running a real Worker, so nothing ever
    // advanced that job out of 'waiting'). Remove it to simulate the job having
    // already been consumed/cleaned up, so the API-equivalent retry below sees a
    // genuinely empty Queue for this analysisId — matching the 'failed -> retry'
    // scenario this test actually means to exercise.
    const staleJob = await deps.aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
    await staleJob?.remove();

    // API-equivalent retry: the same reconciliation rule as
    // scheduleInitialAiExplanation (decision 9), anchored on 'completed'.
    const recoverResult = await recoverAiExplanationEnqueue(analysisId, deps);
    expect(recoverResult).toBe('enqueued');
    await analysisRepository.updateStatus(analysisId, 'completed', { aiStatus: 'queued' });

    const afterRetryEnqueue = await analysisRepository.findById(analysisId);
    expect(afterRetryEnqueue?.status).toBe('completed'); // unchanged until the Worker claims
    expect(afterRetryEnqueue?.aiStatus).toBe('queued');

    // Worker claim (real handler run) — this time with a succeeding Provider.
    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), { ...deps, aiProvider: new FakeAIProvider() });

    const final = await analysisRepository.findById(analysisId);
    expect(final?.status).toBe('completed');
    expect(final?.aiStatus).toBe('success');
    const record = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(record).not.toBeNull();
  });

  it('T-AI-04: the identical end state is reached via a genuine in-flight BullMQ retry, with no separate Retry-API call', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const analysisRepository = new PrismaAnalysisRepository(deps.prisma);

    const flakyProvider = new FakeAIProvider({ failWith: new AIProviderError('AI_PROVIDER_TIMEOUT', 'transient') });
    const flakyDeps = { ...deps, aiProvider: flakyProvider };

    // Attempt 1 of 3 fails but is not exhausted — rethrows without
    // persisting a terminal failure.
    await expect(handleAiExplanationJob(fakeAiExplanationJob(analysisId, 1, 3), flakyDeps)).rejects.toThrow();
    const midRetry = await analysisRepository.findById(analysisId);
    expect(midRetry?.status).toBe('explaining'); // claimed, still mid-flight
    expect(midRetry?.aiStatus).toBe('running');

    // Attempt 2 (same job, BullMQ's own retry) — now succeeds.
    await handleAiExplanationJob(fakeAiExplanationJob(analysisId, 2, 3), {
      ...deps,
      aiProvider: new FakeAIProvider(),
    });

    const final = await analysisRepository.findById(analysisId);
    expect(final?.status).toBe('completed');
    expect(final?.aiStatus).toBe('success');
  });
});
