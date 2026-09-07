import { AIProviderError } from '@polaris/ai';
import { PrismaAIExplanationRepository, PrismaAnalysisExecutionRepository, PrismaAnalysisRepository } from '@polaris/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleAiExplanationJob } from '../ai-explanation-job-handler.js';
import { FakeAIProvider } from './fake-ai-provider.js';
import { withFailingTransaction } from './prisma-fault-injection.js';
import { buildWorkerDeps, fakeAiExplanationJob, resetDatabase, setUpAnalysisReadyForAiExplanation } from './worker-test-helpers.js';

/**
 * md/44_Development_Setup_and_Sixth_Sprint.md §100's required failure
 * matrix.
 */
describe('AI Explanation failure injection', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  async function expectRetryable(code: string): Promise<void> {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const failingDeps = { ...deps, aiProvider: new FakeAIProvider({ failWith: new AIProviderError(code as never, 'simulated') }) };

    // attemptsStarted=1 of 3 — not exhausted, so it rethrows without
    // finalizing to a terminal failure.
    await expect(handleAiExplanationJob(fakeAiExplanationJob(analysisId, 1, 3), failingDeps)).rejects.toThrow();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('explaining'); // claimed, retried — not finalized yet
    expect(analysis?.aiStatus).toBe('running');
  }

  it('Provider timeout is retryable', async () => {
    await expectRetryable('AI_PROVIDER_TIMEOUT');
  });

  it('Provider rate limit (429) is retryable', async () => {
    await expectRetryable('AI_PROVIDER_RATE_LIMITED');
  });

  it('Provider auth failure is terminal (non-retryable)', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const failingDeps = {
      ...deps,
      aiProvider: new FakeAIProvider({ failWith: new AIProviderError('AI_PROVIDER_AUTH_FAILED', 'bad key') }),
    };

    await expect(handleAiExplanationJob(fakeAiExplanationJob(analysisId, 1, 3), failingDeps)).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('completed');
    expect(analysis?.aiStatus).toBe('failed');
  });

  it('an invalid structured result (fails Zod re-validation) is retryable', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const invalidOutputProvider = {
      generateExplanation: async () => ({
        provider: 'openai' as const,
        model: 'fake-model',
        output: { summary: 'missing everything else' }, // structurally invalid
      }),
    };

    await expect(
      handleAiExplanationJob(fakeAiExplanationJob(analysisId, 1, 3), { ...deps, aiProvider: invalidOutputProvider }),
    ).rejects.toThrow();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('explaining');
    expect(analysis?.aiStatus).toBe('running');
  });

  it('an invalid Reference (fails Grounding Validation) is retryable', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const badReferenceProvider = new FakeAIProvider({ groupIds: ['path:does-not-exist-at-all'] });

    await expect(
      handleAiExplanationJob(fakeAiExplanationJob(analysisId, 1, 3), { ...deps, aiProvider: badReferenceProvider }),
    ).rejects.toThrow();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('explaining');
    expect(analysis?.aiStatus).toBe('running');
    const record = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(record).toBeNull(); // never persisted
  });

  it('a persist failure after a valid result is retryable, not a terminal AI failure', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    // persistAiExplanationSuccess runs inside prisma.$transaction(), whose
    // callback receives a fresh transaction-scoped client the real
    // PrismaClient creates internally — a Proxy wrapping only
    // aIExplanationRecord.create on the outer client never intercepts that
    // inner call. withFailingTransaction (the established fault-injection
    // helper for exactly this shape, see prisma-fault-injection.ts) fails
    // $transaction itself instead.
    const failingPrisma = withFailingTransaction(deps.prisma, 'simulated DB outage during persist');

    await expect(
      handleAiExplanationJob(fakeAiExplanationJob(analysisId, 1, 3), { ...deps, prisma: failingPrisma }),
    ).rejects.toThrow();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('explaining');
    expect(analysis?.aiStatus).toBe('running');
  });

  it('retry exhaustion finalizes to aiStatus=failed / Analysis.status=completed', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const alwaysFailingDeps = {
      ...deps,
      aiProvider: new FakeAIProvider({ failWith: new AIProviderError('AI_PROVIDER_UNAVAILABLE', 'down') }),
    };

    // attemptsStarted === attempts (2 of 2) — this is the final attempt.
    await expect(handleAiExplanationJob(fakeAiExplanationJob(analysisId, 2, 2), alwaysFailingDeps)).rejects.toThrow();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('completed');
    expect(analysis?.aiStatus).toBe('failed');

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'ai_explanation',
    );
    expect(execution?.status).toBe('failed');
    expect(execution?.errorCode).toBe('AI_PROVIDER_UNAVAILABLE');
  });
});
