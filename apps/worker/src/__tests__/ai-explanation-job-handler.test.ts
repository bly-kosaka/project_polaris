import type { AIProvider, AIProviderRequest, AIProviderResult } from '@polaris/ai';
import { PrismaAIExplanationRepository, PrismaAnalysisExecutionRepository, PrismaAnalysisRepository } from '@polaris/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleAiExplanationJob } from '../ai-explanation-job-handler.js';
import { handleAnalyzerJob } from '../analyzer-job-handler.js';
import { FakeAIProvider } from './fake-ai-provider.js';
import {
  buildWorkerDeps,
  fakeAiExplanationJob,
  fakeJob,
  resetDatabase,
  setUpAnalysisReadyForAiExplanation,
  setUpUploadedAnalysis,
} from './worker-test-helpers.js';

describe('handleAiExplanationJob', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('success path: persists AIExplanationRecord, Analysis reaches completed/aiStatus=success', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), deps);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('completed');
    expect(analysis?.aiStatus).toBe('success');

    const record = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(record).not.toBeNull();
    expect(record?.provider).toBe('openai');

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'ai_explanation',
    );
    expect(execution?.status).toBe('success');
    expect(execution?.attempt).toBe(1);
  });

  it('T-AI-02: after a successful claim, Analysis is briefly status=explaining/aiStatus=running', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);

    const observingProvider: AIProvider = {
      generateExplanation: async (request: AIProviderRequest): Promise<AIProviderResult> => {
        const midFlight = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
        expect(midFlight?.status).toBe('explaining');
        expect(midFlight?.aiStatus).toBe('running');
        return new FakeAIProvider().generateExplanation(request);
      },
    };

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), { ...deps, aiProvider: observingProvider });
  });

  it('idempotency: a duplicate delivery after a successful persist never calls the Provider again', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);
    const provider = new FakeAIProvider();
    const depsWithCountingProvider = { ...deps, aiProvider: provider };

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), depsWithCountingProvider);
    expect(provider.callCount).toBe(1);

    // Simulate a crash-retry: same job, a later attempt.
    await handleAiExplanationJob(fakeAiExplanationJob(analysisId, 2), depsWithCountingProvider);
    expect(provider.callCount).toBe(1);

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'ai_explanation',
    );
    expect(execution?.attempt).toBe(1);
  });

  it('claim precondition: an Analysis whose AnalyzerStatus is not success|partial is a no-op', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'invalid.log');
    await handleAnalyzerJob(fakeJob(analysisId), deps).catch(() => {
      // expected: invalid.log is a fatal Analyzer result, throws UnrecoverableError
    });

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), deps);

    const record = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(record).toBeNull();
  });
});
