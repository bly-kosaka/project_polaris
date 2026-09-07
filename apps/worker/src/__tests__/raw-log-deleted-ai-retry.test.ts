import { PrismaAIExplanationRepository, PrismaAnalysisRepository, PrismaUploadedAccessLogRepository } from '@polaris/db';
import type { TemporaryObjectStorage } from '@polaris/storage';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleAiExplanationJob } from '../ai-explanation-job-handler.js';
import type { WorkerDeps } from '../deps.js';
import { FakeAIProvider } from './fake-ai-provider.js';
import { buildWorkerDeps, fakeAiExplanationJob, resetDatabase, setUpAnalysisReadyForAiExplanation } from './worker-test-helpers.js';

/**
 * A6-17 / §94: AI Explanation must succeed (and be retryable) even though
 * the Raw Log is already gone — proving the AI Handler never touches
 * Storage, structurally, not just by observation.
 */
describe('AI Explanation after Raw Log deletion', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('succeeds even with a Storage that throws on every call — the Analyzer already deleted the Raw Log before AI ever runs', async () => {
    const { analysisId } = await setUpAnalysisReadyForAiExplanation(deps);

    // The real Analyzer run inside setUpAnalysisReadyForAiExplanation
    // already deletes the Raw Log on success — confirm that before
    // asserting anything about the AI path.
    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.status).toBe('deleted');

    const storageThatAlwaysThrows: TemporaryObjectStorage = {
      putObject: async () => {
        throw new Error('AI Explanation must never call Storage');
      },
      exists: async () => {
        throw new Error('AI Explanation must never call Storage');
      },
      getObjectStream: async () => {
        throw new Error('AI Explanation must never call Storage');
      },
      deleteObject: async () => {
        throw new Error('AI Explanation must never call Storage');
      },
    };
    const depsWithBrokenStorage: WorkerDeps = {
      ...deps,
      storage: storageThatAlwaysThrows,
      aiProvider: new FakeAIProvider(),
    };

    await handleAiExplanationJob(fakeAiExplanationJob(analysisId), depsWithBrokenStorage);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('completed');
    expect(analysis?.aiStatus).toBe('success');
    const record = await new PrismaAIExplanationRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(record).not.toBeNull();
  });
});
