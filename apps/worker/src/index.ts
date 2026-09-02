import { S3Client } from '@aws-sdk/client-s3';
import { prisma } from '@polaris/db';
import { ANALYZER_QUEUE, createMaintenanceQueue, createWorkerConnection, MAINTENANCE_QUEUE, RAW_LOG_DELETE_JOB } from '@polaris/queue';
import type { AnalyzerJobData, CleanupExpiredRawLogsJobData, RawLogDeleteJobData } from '@polaris/queue';
import { loadEnv } from '@polaris/shared';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import { Worker } from 'bullmq';
import { handleAnalyzerJob } from './analyzer-job-handler.js';
import { handleCleanupJob } from './cleanup-job-handler.js';
import type { WorkerDeps } from './deps.js';
import { handleRawLogDeleteJob } from './raw-log-delete-job-handler.js';

async function main(): Promise<void> {
  const env = loadEnv();

  const s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  await ensureBucket(s3Client, env.S3_BUCKET);
  const storage = new S3TemporaryObjectStorage(s3Client, env.S3_BUCKET);

  const connection = createWorkerConnection(env.REDIS_URL);

  const deps: WorkerDeps = {
    prisma,
    storage,
    maintenanceQueue: createMaintenanceQueue(connection),
  };

  // Concurrency: 1 for correctness-first (34_Development_Setup_and_Fourth_Sprint.md §70).
  const analyzerWorker = new Worker<AnalyzerJobData>(
    ANALYZER_QUEUE,
    async (job) => handleAnalyzerJob(job, deps),
    { connection, concurrency: 1 },
  );

  const maintenanceWorker = new Worker<RawLogDeleteJobData | CleanupExpiredRawLogsJobData>(
    MAINTENANCE_QUEUE,
    async (job) => {
      if (job.name === RAW_LOG_DELETE_JOB) {
        return handleRawLogDeleteJob(job as never, deps);
      }
      return handleCleanupJob(job as never, deps);
    },
    { connection, concurrency: 1 },
  );

  let shuttingDown = false;
  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all([analyzerWorker.close(), maintenanceWorker.close()]);
    await deps.maintenanceQueue.close();
    connection.disconnect();
    await prisma.$disconnect();
  }

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error('Worker failed to start', error);
  process.exitCode = 1;
});
