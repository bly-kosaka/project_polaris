import {
  PrismaAnalysisExecutionRepository,
  PrismaAnalysisRepository,
  PrismaObservationSetRepository,
  PrismaUploadedAccessLogRepository,
} from '@polaris/db';
import { createMaintenanceQueue } from '@polaris/queue';
import { StorageError } from '@polaris/storage';
import type { TemporaryObjectStorage } from '@polaris/storage';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkerDeps } from '../deps.js';
import { runAnalyzerJobToSettlement } from './bullmq-test-helpers.js';
import {
  withFailingAnalysisUpdate,
  withFailingExecutionUpdateOnFinalize,
  withFailingTransaction,
} from './prisma-fault-injection.js';
import { buildWorkerDeps, resetDatabase, setUpUploadedAnalysis } from './worker-test-helpers.js';

/**
 * M-04 (36_Sprint_4_Review.md): failure injection against real
 * PostgreSQL/Redis/MinIO, driven through a real BullMQ Worker + Queue
 * (see bullmq-test-helpers.ts) rather than calling handleAnalyzerJob
 * directly — the gap the review found was that unit-level tests could pass
 * even though real BullMQ retry/exhaustion never got exercised.
 */
describe('failure injection (M-04)', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('C-01 regression: a transient DB failure while persisting a Fatal Analyzer result is retried, not stranded at analyzing', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'invalid.log');

    const depsWithFlakyPersist: WorkerDeps = {
      ...deps,
      prisma: withFailingAnalysisUpdate(deps.prisma, 1, 'simulated transient DB failure while persisting failure state'),
    };

    const state = await runAnalyzerJobToSettlement(depsWithFlakyPersist, deps.connection, analysisId, {
      attempts: 3,
    });
    expect(state).toBe('failed'); // BullMQ's failed set, via UnrecoverableError once the persist finally succeeds

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('failed'); // not stuck at 'analyzing'
    expect(analysis?.analyzerStatus).toBe('failed');

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'analyzer',
    );
    expect(execution?.status).toBe('failed');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).toBeNull();
  }, 15000);

  it('M-05 regression: an AnalysisExecution metadata-update failure after a successful failure-persist does not undo it', async () => {
    const { analysisId, storageKey } = await setUpUploadedAnalysis(deps, 'invalid.log');

    const depsWithFlakyExecutionUpdate: WorkerDeps = {
      ...deps,
      prisma: withFailingExecutionUpdateOnFinalize(deps.prisma, 'simulated AnalysisExecution finalize-update failure'),
    };

    const state = await runAnalyzerJobToSettlement(depsWithFlakyExecutionUpdate, deps.connection, analysisId, {
      attempts: 2,
    });
    // persistAnalyzerFailure() itself succeeds on the very first attempt —
    // this must still reach UnrecoverableError, not silently retry/
    // complete because the *metadata* update afterward failed.
    expect(state).toBe('failed');

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('failed'); // the commit point held
    expect(analysis?.analyzerStatus).toBe('failed');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).toBeNull();

    // Raw Log reconciliation still ran despite the Execution-metadata
    // failure (36_Sprint_4_Review.md M-05's ordering requirement).
    expect(await deps.storage.exists(storageKey)).toBe(false);
  }, 15000);

  it('storage.getObjectStream transient failure is retried and succeeds on the next attempt', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');

    let getStreamCallCount = 0;
    const flakyStorage: TemporaryObjectStorage = {
      putObject: (params) => deps.storage.putObject(params),
      exists: (key) => deps.storage.exists(key),
      deleteObject: (key) => deps.storage.deleteObject(key),
      getObjectStream: async (key) => {
        getStreamCallCount += 1;
        if (getStreamCallCount === 1) {
          throw new StorageError('TRANSIENT', 'simulated transient storage read failure');
        }
        return deps.storage.getObjectStream(key);
      },
    };
    const depsWithFlakyStorage: WorkerDeps = { ...deps, storage: flakyStorage };

    const state = await runAnalyzerJobToSettlement(depsWithFlakyStorage, deps.connection, analysisId, {
      attempts: 3,
    });
    expect(state).toBe('completed');

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull();

    expect(getStreamCallCount).toBeGreaterThanOrEqual(2);
  }, 15000);

  it('M-01: storage.getObjectStream permanently failing exhausts retries — Analysis/Execution fail and the Raw Log is retained', async () => {
    const { analysisId, storageKey } = await setUpUploadedAnalysis(deps, 'valid.log');

    const alwaysFailingStorage: TemporaryObjectStorage = {
      putObject: (params) => deps.storage.putObject(params),
      exists: (key) => deps.storage.exists(key),
      deleteObject: (key) => deps.storage.deleteObject(key),
      getObjectStream: async () => {
        throw new StorageError('TRANSIENT', 'simulated permanent storage read failure');
      },
    };
    const depsWithFailingStorage: WorkerDeps = { ...deps, storage: alwaysFailingStorage };

    const state = await runAnalyzerJobToSettlement(depsWithFailingStorage, deps.connection, analysisId, {
      attempts: 2,
      backoffMs: 100,
    });
    expect(state).toBe('failed');

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('failed');
    expect(analysis?.analyzerStatus).toBe('failed');

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'analyzer',
    );
    expect(execution?.status).toBe('failed');

    // Raw Log retained — a Storage-read failure is not proof the log itself
    // is bad, unlike a non-retryable Analyzer result (36_Sprint_4_Review.md M-01).
    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.status).toBe('processing');
    expect(await deps.storage.exists(storageKey)).toBe(true);
  }, 15000);

  it('T-13: persistAnalyzerSuccess permanently failing exhausts retries and finalizes DB state to failed', async () => {
    const { analysisId, storageKey } = await setUpUploadedAnalysis(deps, 'valid.log');

    const depsWithFailingTransaction: WorkerDeps = {
      ...deps,
      prisma: withFailingTransaction(deps.prisma, 'simulated permanent DB failure'),
    };

    const state = await runAnalyzerJobToSettlement(depsWithFailingTransaction, deps.connection, analysisId, {
      attempts: 2,
      backoffMs: 100,
    });
    expect(state).toBe('failed');

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('failed');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).toBeNull(); // the transaction never committed

    // Persist Failure -> Raw Log remains (T-04/T-05's invariant, also true at exhaustion).
    expect(await deps.storage.exists(storageKey)).toBe(true);
  }, 15000);

  it('M-03: a Maintenance-queue enqueue failure never turns a successful Analyzer job into a failure', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');

    const failingDeleteStorage: TemporaryObjectStorage = {
      putObject: (params) => deps.storage.putObject(params),
      exists: (key) => deps.storage.exists(key),
      getObjectStream: (key) => deps.storage.getObjectStream(key),
      deleteObject: async () => {
        throw new StorageError('TRANSIENT', 'simulated delete failure');
      },
    };
    // A closed queue rejects any add() call — simulates the Maintenance
    // queue/Redis being unavailable at the moment reconcileRawLogDeletion
    // tries to enqueue a delete retry. A throwaway queue instance, not
    // `deps.maintenanceQueue` itself, so the shared fixture is untouched.
    const unavailableMaintenanceQueue = createMaintenanceQueue(deps.connection);
    await unavailableMaintenanceQueue.close();

    const depsWithBothFailing: WorkerDeps = {
      ...deps,
      storage: failingDeleteStorage,
      maintenanceQueue: unavailableMaintenanceQueue,
    };

    const state = await runAnalyzerJobToSettlement(depsWithBothFailing, deps.connection, analysisId, {
      attempts: 2,
    });
    // The Analyzer result itself (ObservationSet persisted) must still be a
    // success, even though both the delete and the retry-enqueue failed.
    expect(state).toBe('completed');

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull();

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.deletionStatus).toBe('failed');
  }, 15000);
});
