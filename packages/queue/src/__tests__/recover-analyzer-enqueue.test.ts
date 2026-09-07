import { PrismaAnalysisRepository, PrismaProjectRepository, persistUploadedAccessLog, prisma } from '@polaris/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'bullmq';
import { ANALYZER_QUEUE } from '../queue-names.js';
import { buildAnalyzerJobId } from '../job-types.js';
import { createAnalyzerQueue } from '../queues.js';
import { createProducerConnection, createWorkerConnection } from '../connection.js';
import { recoverAnalyzerEnqueue } from '../recover-analyzer-enqueue.js';

async function resetDatabase(): Promise<void> {
  await prisma.observationSetRecord.deleteMany();
  await prisma.analysisExecution.deleteMany();
  await prisma.uploadedAccessLog.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.project.deleteMany();
  await prisma.account.deleteMany();
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';

async function createTestAccount(): Promise<{ id: string }> {
  return prisma.account.create({ data: { authProvider: 'clerk', authSubject: `test-subject-${Date.now()}-${Math.random()}`, emailVerified: true } });
}

async function createUploadedAnalysis(): Promise<string> {
  const account = await createTestAccount();
  const project = await new PrismaProjectRepository(prisma).create({ name: `Recovery Test ${Date.now()}`, ownerAccountId: account.id });
  const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId: project.id });
  await persistUploadedAccessLog(prisma, {
    analysisId: analysis.id,
    originalFileName: 'access.log',
    sizeBytes: 100,
    storageKey: `raw-logs/${analysis.id}/test`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  return analysis.id;
}

describe('recoverAnalyzerEnqueue (T-18, M-01R)', () => {
  const producerConnection = createProducerConnection(REDIS_URL);
  const workerConnection = createWorkerConnection(REDIS_URL);
  const analyzerQueue = createAnalyzerQueue(producerConnection);

  beforeEach(async () => {
    await resetDatabase();
    await analyzerQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await analyzerQueue.close();
    producerConnection.disconnect();
    workerConnection.disconnect();
  });

  it('enqueues the Analyzer job when none exists yet', async () => {
    const analysisId = await createUploadedAnalysis();

    const before = await analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
    expect(before).toBeUndefined();

    const outcome = await recoverAnalyzerEnqueue(analysisId, { prisma, analyzerQueue });
    expect(outcome).toBe('enqueued');

    const after = await analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
    expect(after).toBeDefined();
  });

  it('is a no-op for an Analysis that is not in the uploaded state', async () => {
    const account = await createTestAccount();
    const project = await new PrismaProjectRepository(prisma).create({ name: `Recovery Noop ${Date.now()}`, ownerAccountId: account.id });
    const analysis = await new PrismaAnalysisRepository(prisma).create({ projectId: project.id });

    const outcome = await recoverAnalyzerEnqueue(analysis.id, { prisma, analyzerQueue });
    expect(outcome).toBe('skipped');
  });

  it('is a no-op when a job is already waiting (not yet processed)', async () => {
    const analysisId = await createUploadedAnalysis();
    await recoverAnalyzerEnqueue(analysisId, { prisma, analyzerQueue }); // creates the job ('enqueued')

    const outcome = await recoverAnalyzerEnqueue(analysisId, { prisma, analyzerQueue });
    expect(outcome).toBe('skipped'); // still sitting in `waiting`, untouched
  });

  it('M-01R: retries an existing failed job instead of silently no-op-ing on the duplicate jobId', async () => {
    const analysisId = await createUploadedAnalysis();

    // A BullMQ add() with a jobId that already belongs to a finished
    // (failed/completed) job is silently ignored — no error, no new job —
    // confirmed against BullMQ's own docs on job-id deduplication. Get a
    // job into `failed` for real (a worker whose processor always throws,
    // attempts: 1) rather than asserting against that behavior secondhand.
    const worker = new Worker(
      ANALYZER_QUEUE,
      async () => {
        throw new Error('simulated: this attempt always fails');
      },
      { connection: workerConnection, concurrency: 1 },
    );
    try {
      await worker.waitUntilReady();
      // attempts: 1 (not enqueueAnalyzerJob's production 3-attempt
      // exponential backoff) — this test only needs the job to land in
      // `failed` quickly, not to exercise retry timing.
      await analyzerQueue.add('analyzer', { analysisId }, { jobId: buildAnalyzerJobId(analysisId), attempts: 1 });

      const deadline = Date.now() + 5000;
      let failedState: string | undefined;
      while (Date.now() < deadline && failedState !== 'failed') {
        const job = await analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
        failedState = await job?.getState();
        if (failedState !== 'failed') await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(failedState).toBe('failed');
    } finally {
      await worker.close();
    }

    // A plain enqueue would silently no-op here — the point of M-01R.
    const outcome = await recoverAnalyzerEnqueue(analysisId, { prisma, analyzerQueue });
    expect(outcome).toBe('retried');

    const job = await analyzerQueue.getJob(buildAnalyzerJobId(analysisId));
    const state = await job?.getState();
    expect(state).not.toBe('failed'); // moved back to a processable state
  }, 15000);
});
