import { S3Client } from '@aws-sdk/client-s3';
import { selectProvider } from '@polaris/ai';
import { prisma } from '@polaris/db';
import {
  AI_EXPLANATION_QUEUE,
  ANALYZER_QUEUE,
  createAiExplanationQueue,
  createMaintenanceQueue,
  createWorkerConnection,
  MAINTENANCE_QUEUE,
  RAW_LOG_DELETE_JOB,
  registerCleanupScheduler,
} from '@polaris/queue';
import type { AIExplanationJobData, AnalyzerJobData, CleanupExpiredRawLogsJobData, RawLogDeleteJobData } from '@polaris/queue';
import { loadEnv } from '@polaris/shared';
import { ensureBucket, S3TemporaryObjectStorage } from '@polaris/storage';
import { Worker } from 'bullmq';
import { handleAiExplanationJob } from './ai-explanation-job-handler.js';
import { handleAnalyzerJob } from './analyzer-job-handler.js';
import { handleCleanupJob } from './cleanup-job-handler.js';
import type { WorkerDeps } from './deps.js';
import { handleRawLogDeleteJob } from './raw-log-delete-job-handler.js';
import { resolveAiModelConfig } from './resolve-ai-model-config.js';

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

  // Resolved once, at bootstrap — the Job Handler/Adapter never read
  // process.env or the Provider Registry themselves
  // (46_Sprint_6_Plan_Final_Review.md F-04/F-06).
  const aiModelConfig = resolveAiModelConfig(env);
  const aiProvider = selectProvider(aiModelConfig.provider, {
    ...(env.OPENAI_API_KEY !== undefined ? { apiKey: env.OPENAI_API_KEY } : {}),
  });

  const deps: WorkerDeps = {
    prisma,
    storage,
    maintenanceQueue: createMaintenanceQueue(connection),
    aiExplanationQueue: createAiExplanationQueue(connection),
    aiModelConfig,
    aiProvider,
  };

  // Concurrency: 1 for correctness-first (34_Development_Setup_and_Fourth_Sprint.md §70).
  const analyzerWorker = new Worker<AnalyzerJobData>(
    ANALYZER_QUEUE,
    async (job) => handleAnalyzerJob(job, deps),
    { connection, concurrency: 1 },
  );

  // Separate, low concurrency — an external Provider Rate Limit applies
  // here, unlike the Analyzer Queue (44_Development_Setup_and_Sixth_Sprint.md §88).
  const aiExplanationWorker = new Worker<AIExplanationJobData>(
    AI_EXPLANATION_QUEUE,
    async (job) => handleAiExplanationJob(job, deps),
    { connection, concurrency: env.AI_WORKER_CONCURRENCY },
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

  // 24h Retention safety net (34_Development_Setup_and_Fourth_Sprint.md §38-39)
  // only actually fires if something enqueues it — registering a repeatable
  // scheduler here is that "something" (36_Sprint_4_Review.md M-02).
  // Idempotent by scheduler id, so re-registering on every restart is safe.
  await registerCleanupScheduler(deps.maintenanceQueue);

  let shuttingDown = false;
  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all([analyzerWorker.close(), aiExplanationWorker.close(), maintenanceWorker.close()]);
    await Promise.all([deps.maintenanceQueue.close(), deps.aiExplanationQueue.close()]);
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
