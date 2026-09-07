import { PrismaAnalysisRepository } from '@polaris/db';
import { buildAiExplanationJobId } from '@polaris/queue';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scheduleInitialAiExplanation } from '../schedule-ai-explanation.js';
import { buildWorkerDeps, resetDatabase, setUpUploadedAnalysis } from './worker-test-helpers.js';

describe('scheduleInitialAiExplanation', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  async function createAnalysisAtAnalyzerResultReady(): Promise<string> {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');
    await new PrismaAnalysisRepository(deps.prisma).updateStatus(analysisId, 'analyzing');
    await new PrismaAnalysisRepository(deps.prisma).updateStatus(analysisId, 'analyzer_result_ready', {
      analyzerStatus: 'success',
    });
    return analysisId;
  }

  it('T-AI-01: enqueues the job and persists aiStatus=queued, leaving Analysis.status untouched', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();

    await scheduleInitialAiExplanation(analysisId, deps);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');
    expect(analysis?.aiStatus).toBe('queued');

    const job = await deps.aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
    expect(job).toBeDefined();
  });

  it('never throws when the Queue is unreachable, and never touches Analysis.status', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();
    const brokenQueue = {
      getJob: async () => {
        throw new Error('simulated Redis outage');
      },
    } as unknown as typeof deps.aiExplanationQueue;

    await expect(scheduleInitialAiExplanation(analysisId, { ...deps, aiExplanationQueue: brokenQueue })).resolves.toBeUndefined();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');
    expect(analysis?.aiStatus).toBe('not_requested');
  });

  it('T-AI-06: reconciles aiStatus to queued even when a prior enqueue attempt already landed a Queue job (drift)', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();

    // Simulate the drift directly: a job is already sitting in the Queue,
    // but the DB write from that earlier attempt never landed.
    await scheduleInitialAiExplanation(analysisId, deps); // creates the job, sets aiStatus=queued
    await new PrismaAnalysisRepository(deps.prisma).compareAndSetStatus(
      analysisId,
      'analyzer_result_ready',
      'analyzer_result_ready',
      { aiStatus: 'not_requested' }, // simulate the DB write having failed/reverted
    );

    const before = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(before?.aiStatus).toBe('not_requested');

    await scheduleInitialAiExplanation(analysisId, deps);

    const after = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(after?.aiStatus).toBe('queued');
  });

  it('is a no-op write when the Worker has already claimed the job (already_running)', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();
    await scheduleInitialAiExplanation(analysisId, deps);

    // Simulate the Worker's own claim having already advanced status.
    await new PrismaAnalysisRepository(deps.prisma).compareAndSetStatus(
      analysisId,
      'analyzer_result_ready',
      'explaining',
      { aiStatus: 'running' },
    );

    await scheduleInitialAiExplanation(analysisId, deps);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('explaining'); // untouched — not stomped back
    expect(analysis?.aiStatus).toBe('running');
  });
});
