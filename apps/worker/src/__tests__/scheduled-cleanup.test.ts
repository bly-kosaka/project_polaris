import { Readable } from 'node:stream';
import { PrismaAnalysisRepository, PrismaProjectRepository, PrismaUploadedAccessLogRepository } from '@polaris/db';
import { CLEANUP_JOB, MAINTENANCE_QUEUE, RAW_LOG_DELETE_JOB, registerCleanupScheduler } from '@polaris/queue';
import type { CleanupExpiredRawLogsJobData, RawLogDeleteJobData } from '@polaris/queue';
import { buildRawLogStorageKey } from '@polaris/storage';
import { Worker } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleCleanupJob } from '../cleanup-job-handler.js';
import { handleRawLogDeleteJob } from '../raw-log-delete-job-handler.js';
import { buildWorkerDeps, createTestAccount, resetDatabase } from './worker-test-helpers.js';

/**
 * M-02 (36_Sprint_4_Review.md): `enqueueCleanupJob()`/`handleCleanupJob()`
 * existing was not enough — nothing was actually registering the repeatable
 * schedule, so the 24h Retention safety net never fired on its own. This
 * proves the whole chain: registerCleanupScheduler -> BullMQ scheduler ->
 * enqueued job -> a real Worker -> handleCleanupJob -> expired Raw Log
 * deleted, using a short repeat interval so the test doesn't wait an hour.
 */
describe('scheduled cleanup (M-02)', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterEach(async () => {
    await deps.close();
  });

  it('a registered scheduler produces a Cleanup Job that a real Worker picks up and processes', async () => {
    const account = await createTestAccount();
    const project = await new PrismaProjectRepository(deps.prisma).create({ name: `Scheduled Cleanup ${Date.now()}`, ownerAccountId: account.id });
    const analysis = await new PrismaAnalysisRepository(deps.prisma).create({ projectId: project.id });
    const storageKey = buildRawLogStorageKey(analysis.id);
    await deps.storage.putObject({ key: storageKey, body: Readable.from(['line\n']) });
    await new PrismaUploadedAccessLogRepository(deps.prisma).create({
      analysisId: analysis.id,
      originalFileName: 'access.log',
      sizeBytes: 5,
      storageKey,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // already expired
    });

    const worker = new Worker<RawLogDeleteJobData | CleanupExpiredRawLogsJobData>(
      MAINTENANCE_QUEUE,
      async (job) => {
        if (job.name === RAW_LOG_DELETE_JOB) return handleRawLogDeleteJob(job as never, deps);
        return handleCleanupJob(job as never, deps);
      },
      { connection: deps.connection, concurrency: 1 },
    );

    try {
      await worker.waitUntilReady();
      // Short repeat interval — the scheduler is exercised for real, not
      // mocked, just on a much shorter clock than production's hourly one.
      await registerCleanupScheduler(deps.maintenanceQueue, 500);

      const deadline = Date.now() + 10000;
      let deleted = false;
      while (Date.now() < deadline && !deleted) {
        const row = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysis.id);
        deleted = row?.status === 'expired';
        if (!deleted) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(deleted).toBe(true);
      expect(await deps.storage.exists(storageKey)).toBe(false);
    } finally {
      await worker.close();
    }
  }, 15000);

  it('registering the scheduler twice does not create duplicate schedulers (idempotent by scheduler id)', async () => {
    await registerCleanupScheduler(deps.maintenanceQueue, 3600000);
    await registerCleanupScheduler(deps.maintenanceQueue, 3600000);

    const schedulers = await deps.maintenanceQueue.getJobSchedulers();
    const cleanupSchedulers = schedulers.filter((s) => s.name === CLEANUP_JOB);
    expect(cleanupSchedulers).toHaveLength(1);
  });
});
