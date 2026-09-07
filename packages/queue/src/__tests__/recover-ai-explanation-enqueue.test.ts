import { PrismaAnalysisRepository, PrismaProjectRepository, persistAiExplanationSuccess, prisma } from '@polaris/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'bullmq';
import { AI_EXPLANATION_QUEUE } from '../queue-names.js';
import { buildAiExplanationJobId } from '../job-types.js';
import { createAiExplanationQueue } from '../queues.js';
import { createProducerConnection, createWorkerConnection } from '../connection.js';
import { recoverAiExplanationEnqueue } from '../recover-ai-explanation-enqueue.js';

async function resetDatabase(): Promise<void> {
  await prisma.aIExplanationRecord.deleteMany();
  await prisma.observationSetRecord.deleteMany();
  await prisma.analysisExecution.deleteMany();
  await prisma.uploadedAccessLog.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.project.deleteMany();
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';

async function createAnalysis(): Promise<string> {
  const project = await new PrismaProjectRepository(prisma).create({ name: `AI Recovery Test ${Date.now()}` });
  const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
  return analysis.id;
}

/**
 * `recoverAiExplanationEnqueue` itself only inspects Queue state + whether
 * an AIExplanationRecord exists — it doesn't require any particular
 * Analysis.status. `persistAiExplanationSuccess` does, though, since
 * `updateStatus` enforces the real transition table — advance through the
 * real, legal transitions rather than jumping straight to `completed`.
 */
async function createAnalysisAtAnalyzerResultReady(): Promise<string> {
  const project = await new PrismaProjectRepository(prisma).create({ name: `AI Recovery Test ${Date.now()}` });
  const analysisRepository = new PrismaAnalysisRepository(prisma);
  const analysis = await analysisRepository.create({ projectId: project.id });
  await analysisRepository.updateStatus(analysis.id, 'uploaded');
  await analysisRepository.updateStatus(analysis.id, 'analyzing');
  await analysisRepository.updateStatus(analysis.id, 'analyzer_result_ready', { analyzerStatus: 'success' });
  return analysis.id;
}

/**
 * `44_Development_Setup_and_Sixth_Sprint.md`'s regression-test convention
 * (T-AI-01..06, 46_Sprint_6_Plan_Final_Review.md).
 */
describe('recoverAiExplanationEnqueue', () => {
  const producerConnection = createProducerConnection(REDIS_URL);
  const workerConnection = createWorkerConnection(REDIS_URL);
  const aiExplanationQueue = createAiExplanationQueue(producerConnection);

  beforeEach(async () => {
    await resetDatabase();
    await aiExplanationQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await aiExplanationQueue.close();
    producerConnection.disconnect();
    workerConnection.disconnect();
  });

  it('enqueues the AI Explanation job when none exists and no record exists', async () => {
    const analysisId = await createAnalysis();

    const outcome = await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue });
    expect(outcome).toBe('enqueued');

    const job = await aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
    expect(job).toBeDefined();
  });

  it('reports already_queued when a job is already waiting', async () => {
    const analysisId = await createAnalysis();
    await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue }); // enqueues

    const outcome = await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue });
    expect(outcome).toBe('already_queued');
  });

  it('T-AI-06: reports already_queued even when Analysis.aiStatus is still not_requested (Queue/DB drift)', async () => {
    const analysisId = await createAnalysis();
    await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue }); // job now waiting

    const analysis = await new PrismaAnalysisRepository(prisma).findById(analysisId);
    expect(analysis?.aiStatus).toBe('not_requested'); // recoverAiExplanationEnqueue never writes this itself

    const outcome = await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue });
    expect(outcome).toBe('already_queued');
  });

  it('reports already_completed when an AIExplanationRecord already exists, without touching the Queue', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();
    await persistAiExplanationSuccess(prisma, {
      analysisId,
      provider: 'openai',
      model: 'fake-model',
      promptVersion: 'initial-explanation-v1',
      schemaVersion: '1.0.0',
      data: {
        summary: 's',
        overallUrgency: { level: 'low', reason: 'r', references: [], limitations: [] },
        findings: [],
        overallNotes: [],
        dataLimitations: [],
      },
    });

    const outcome = await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue });
    expect(outcome).toBe('already_completed');

    const job = await aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
    expect(job).toBeUndefined(); // never enqueued — a result already exists
  });

  it('retries an existing failed job instead of silently no-op-ing on the duplicate jobId', async () => {
    const analysisId = await createAnalysis();

    const worker = new Worker(
      AI_EXPLANATION_QUEUE,
      async () => {
        throw new Error('simulated: this attempt always fails');
      },
      { connection: workerConnection, concurrency: 1 },
    );
    try {
      await worker.waitUntilReady();
      await aiExplanationQueue.add(
        'ai-explanation',
        { analysisId },
        { jobId: buildAiExplanationJobId(analysisId), attempts: 1 },
      );

      const deadline = Date.now() + 5000;
      let failedState: string | undefined;
      while (Date.now() < deadline && failedState !== 'failed') {
        const job = await aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
        failedState = await job?.getState();
        if (failedState !== 'failed') await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(failedState).toBe('failed');
    } finally {
      await worker.close();
    }

    const outcome = await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue });
    expect(outcome).toBe('retried');

    const job = await aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
    const state = await job?.getState();
    expect(state).not.toBe('failed');
  }, 15000);

  it('M-02 (48_Sprint_6_Final_ReReview.md): finalizes directly to completed/failed when a BullMQ-failed job left Analysis stuck at aiStatus=running', async () => {
    const analysisId = await createAnalysisAtAnalyzerResultReady();
    const analysisRepository = new PrismaAnalysisRepository(prisma);
    // Simulates the Job Handler having claimed the job (explaining/running)
    // and run the Provider to exhaustion, but the LAST attempt's own
    // persistAiExplanationFailure call itself failing (e.g. a transient DB
    // outage) — Analysis.status/.aiStatus never got to reflect the
    // already-exhausted Provider attempts (BullMQ = failed, PostgreSQL =
    // explaining/running).
    await analysisRepository.compareAndSetStatus(analysisId, 'analyzer_result_ready', 'explaining', { aiStatus: 'running' });

    const worker = new Worker(
      AI_EXPLANATION_QUEUE,
      async () => {
        throw new Error('simulated: Provider attempts exhausted, terminal persist unreachable');
      },
      { connection: workerConnection, concurrency: 1 },
    );
    try {
      await worker.waitUntilReady();
      await aiExplanationQueue.add(
        'ai-explanation',
        { analysisId },
        { jobId: buildAiExplanationJobId(analysisId), attempts: 1 },
      );

      const deadline = Date.now() + 5000;
      let failedState: string | undefined;
      while (Date.now() < deadline && failedState !== 'failed') {
        const job = await aiExplanationQueue.getJob(buildAiExplanationJobId(analysisId));
        failedState = await job?.getState();
        if (failedState !== 'failed') await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(failedState).toBe('failed');
    } finally {
      await worker.close();
    }

    const before = await analysisRepository.findById(analysisId);
    expect(before?.status).toBe('explaining'); // still stuck
    expect(before?.aiStatus).toBe('running');

    const outcome = await recoverAiExplanationEnqueue(analysisId, { prisma, aiExplanationQueue });
    expect(outcome).toBe('finalized_as_failed');

    const after = await analysisRepository.findById(analysisId);
    expect(after?.status).toBe('completed');
    expect(after?.aiStatus).toBe('failed');
  }, 15000);
});
