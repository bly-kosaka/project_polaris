import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerConnection } from '../connection.js';
import { createAnalyzerQueue, createMaintenanceQueue } from '../queues.js';
import { enqueueAnalyzerJob, enqueueRawLogDeleteJob } from '../enqueue.js';
import { buildAnalyzerJobId, buildRawLogDeleteJobId } from '../job-types.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';

describe('enqueue', () => {
  const connection = createWorkerConnection(REDIS_URL);
  const analyzerQueue = createAnalyzerQueue(connection);
  const maintenanceQueue = createMaintenanceQueue(connection);

  beforeEach(async () => {
    await analyzerQueue.obliterate({ force: true });
    await maintenanceQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await analyzerQueue.close();
    await maintenanceQueue.close();
    connection.disconnect();
  });

  it('builds a deterministic, colon-free job id for the Analyzer job', async () => {
    const job = await enqueueAnalyzerJob(analyzerQueue, 'analysis_1');
    expect(job.id).toBe(buildAnalyzerJobId('analysis_1'));
    expect(job.id).not.toContain(':');
    expect(job.data).toEqual({ analysisId: 'analysis_1' });
  });

  it('collapses a duplicate enqueue for the same analysisId into one job (T-01)', async () => {
    await enqueueAnalyzerJob(analyzerQueue, 'analysis_2');
    await enqueueAnalyzerJob(analyzerQueue, 'analysis_2');

    const waiting = await analyzerQueue.getJobs(['waiting', 'delayed']);
    const matching = waiting.filter((job) => job.data.analysisId === 'analysis_2');
    expect(matching).toHaveLength(1);
  });

  it('builds a colon-free job id for the Raw Log delete job', async () => {
    const job = await enqueueRawLogDeleteJob(maintenanceQueue, 'analysis_3');
    expect(job.id).toBe(buildRawLogDeleteJobId('analysis_3'));
    expect(job.id).not.toContain(':');
    expect(job.name).toBe('raw-log-delete');
  });
});
