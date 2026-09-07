import { PrismaAnalysisExecutionRepository, PrismaAnalysisRepository } from '@polaris/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleAiExplanationJob } from '../ai-explanation-job-handler.js';
import { FakeAIProvider } from './fake-ai-provider.js';
import { buildWorkerDeps, fakeAiExplanationJob, resetDatabase, setUpAnalysisReadyForAiExplanation } from './worker-test-helpers.js';

/**
 * Crash-after-Persist recovery (44_Development_Setup_and_Sixth_Sprint.md
 * §57/§101, A6-16) — the AIExplanationRecord is durably persisted, then a
 * simulated crash (a retry delivery of the same job), then confirms the
 * Provider is never called a second time and state is reconciled.
 */
describe('AI Explanation crash-after-persist recovery', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('a duplicate delivery after a successful persist never calls the Provider twice and reconciles the AnalysisExecution', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const provider = new FakeAIProvider();
    const depsWithCountingProvider = { ...deps, aiProvider: provider };

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), depsWithCountingProvider);
    expect(provider.callCount).toBe(1);

    // Simulate the crash: BullMQ never got to mark the job complete, so it
    // delivers the same job again (a later attempt).
    await new PrismaAnalysisExecutionRepository(deps.prisma).updateProgress(analysisId, 'ai_explanation', {
      status: 'running', // pretend the observability metadata never got its final write
    });

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId, 2), depsWithCountingProvider);

    expect(provider.callCount).toBe(1); // still 1 — the Provider was never called again

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('completed');
    expect(analysis?.aiStatus).toBe('success');

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'ai_explanation',
    );
    expect(execution?.status).toBe('success'); // reconciled by the recovery branch
  });
});
