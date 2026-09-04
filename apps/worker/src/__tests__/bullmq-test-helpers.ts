import { ANALYZER_QUEUE, buildAnalyzerJobId, createAnalyzerQueue } from '@polaris/queue';
import type { AnalyzerJobData } from '@polaris/queue';
import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { handleAnalyzerJob } from '../analyzer-job-handler.js';
import type { WorkerDeps } from '../deps.js';

/**
 * M-04 (36_Sprint_4_Review.md): real BullMQ Worker + Queue driving
 * handleAnalyzerJob, not a direct function call against a hand-built `Job`
 * object — proves actual retry/backoff/exhaustion behavior instead of only
 * unit-testing the classification logic. Polls `job.getState()` for a
 * terminal state rather than relying on Worker event-firing semantics
 * (BullMQ's 'failed' event behavior across intermediate vs. final retry
 * attempts is not something to depend on precisely here).
 */
export async function runAnalyzerJobToSettlement(
  deps: WorkerDeps,
  connection: Redis,
  analysisId: string,
  jobOptions: { attempts: number; backoffMs?: number },
  timeoutMs = 20000,
): Promise<'completed' | 'failed'> {
  const queue = createAnalyzerQueue(connection);
  const worker = new Worker<AnalyzerJobData>(ANALYZER_QUEUE, async (job) => handleAnalyzerJob(job, deps), {
    connection,
    concurrency: 1,
  });

  try {
    await worker.waitUntilReady();
    await queue.add(
      'analyzer',
      { analysisId },
      {
        jobId: buildAnalyzerJobId(analysisId),
        attempts: jobOptions.attempts,
        backoff: { type: 'fixed', delay: jobOptions.backoffMs ?? 200 },
      },
    );

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const job = await queue.getJob(buildAnalyzerJobId(analysisId));
      const state = await job?.getState();
      if (state === 'completed' || state === 'failed') return state;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Job for analysisId=${analysisId} did not settle within ${timeoutMs}ms`);
  } finally {
    await worker.close();
    await queue.close();
  }
}
