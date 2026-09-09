import {
  PrismaAnalysisExecutionRepository,
  PrismaAnalysisRepository,
  PrismaObservationSetRepository,
  PrismaUploadedAccessLogRepository,
} from '@polaris/db';
import { buildRawLogDeleteJobId } from '@polaris/queue';
import { StorageError } from '@polaris/storage';
import type { TemporaryObjectStorage } from '@polaris/storage';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleAnalyzerJob } from '../analyzer-job-handler.js';
import type { WorkerDeps } from '../deps.js';
import { buildWorkerDeps, fakeJob, resetDatabase, setUpUploadedAnalysis } from './worker-test-helpers.js';

describe('handleAnalyzerJob', () => {
  let deps: Awaited<ReturnType<typeof buildWorkerDeps>>;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildWorkerDeps();
  });

  afterAll(async () => {
    await deps.close();
  });

  it('success path: persists ObservationSet, advances Analysis, deletes Raw Log', async () => {
    const { analysisId, storageKey } = await setUpUploadedAnalysis(deps, 'valid.log');

    await handleAnalyzerJob(fakeJob(analysisId), deps);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');
    expect(analysis?.analyzerStatus).toBe('success');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull();

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.status).toBe('deleted');
    expect(uploadedAccessLog?.deletionStatus).toBe('success');
    expect(await deps.storage.exists(storageKey)).toBe(false);

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'analyzer',
    );
    expect(execution?.status).toBe('success');
    expect(execution?.attempt).toBe(1);

    const usageEvents = await deps.prisma.usageEvent.findMany({ where: { analysisId } });
    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0]?.metric).toBe('analysis_completed');
  });

  it('partial path: still creates an ObservationSet, Analysis reaches analyzer_result_ready with analyzerStatus=partial', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'partial.log');

    await handleAnalyzerJob(fakeJob(analysisId), deps);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');
    expect(analysis?.analyzerStatus).toBe('partial');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull();
  });

  it('fatal path: PARSER_NO_VALID_LINES throws UnrecoverableError, Analysis fails, no ObservationSet, Raw Log deleted', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'invalid.log');

    await expect(handleAnalyzerJob(fakeJob(analysisId), deps)).rejects.toMatchObject({ name: 'UnrecoverableError' });

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('failed');
    expect(analysis?.analyzerStatus).toBe('failed');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).toBeNull();

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.status).toBe('deleted');

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'analyzer',
    );
    expect(execution?.status).toBe('failed');
    expect(execution?.errorCode).toBe('PARSER_NO_VALID_LINES');

    // T-USAGE-03: a Fatal Analyzer result never records Usage.
    const usageEvents = await deps.prisma.usageEvent.findMany({ where: { analysisId } });
    expect(usageEvents).toHaveLength(0);
  });

  it('T-03: idempotent replay after a successful persist does not re-run the Analyzer or re-persist', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');
    await handleAnalyzerJob(fakeJob(analysisId), deps);

    const executionRepository = new PrismaAnalysisExecutionRepository(deps.prisma);
    const before = await executionRepository.findByAnalysisIdAndType(analysisId, 'analyzer');
    expect(before?.attempt).toBe(1);

    // Simulate a crash-retry: same job, a later attempt.
    await handleAnalyzerJob(fakeJob(analysisId, 2), deps);

    const after = await executionRepository.findByAnalysisIdAndType(analysisId, 'analyzer');
    // Attempt count is untouched — step 4 (AnalysisExecution running/attempt++)
    // never runs on the recovery branch, proving the Analyzer was not re-invoked.
    expect(after?.attempt).toBe(1);

    const observationSetRepository = new PrismaObservationSetRepository(deps.prisma);
    const observationSet = await observationSetRepository.findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull();

    // T-USAGE-02: the Worker's own crash-retry/duplicate-delivery path
    // never re-runs persistAnalyzerSuccess (proven above via unchanged
    // AnalysisExecution.attempt), so UsageEvent must still be exactly 1.
    const usageEvents = await deps.prisma.usageEvent.findMany({ where: { analysisId } });
    expect(usageEvents).toHaveLength(1);
  });

  it('T-02/T-15: a CAS loser on its first activation is a no-op, not a retry', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');
    // Simulate another Worker having already claimed this job.
    await new PrismaAnalysisRepository(deps.prisma).updateStatus(analysisId, 'analyzing');

    await handleAnalyzerJob(fakeJob(analysisId, 1), deps);

    const execution = await new PrismaAnalysisExecutionRepository(deps.prisma).findByAnalysisIdAndType(
      analysisId,
      'analyzer',
    );
    expect(execution).toBeNull(); // step 4 never reached — Analyzer was never invoked

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).toBeNull();
  });

  it('T-16: a genuine retry (attemptsStarted > 1) on an already-analyzing Analysis resumes the Analyzer', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');
    // Simulate a Worker crash after CAS but before the Analyzer ran.
    await new PrismaAnalysisRepository(deps.prisma).updateStatus(analysisId, 'analyzing');

    await handleAnalyzerJob(fakeJob(analysisId, 2), deps);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull();
  });

  it('T-20: handleAnalyzerJob itself marks the Raw Log as processing right after claiming (m-02 strengthening)', async () => {
    // A fault placed at "markProcessing has already run, Analyzer hasn't
    // started yet" via a getObjectStream that always throws — the handler
    // stops there (retryable, attempts not exhausted), so the resulting DB
    // state is a genuine side effect of handleAnalyzerJob's own code path,
    // not a manual repository call standing in for it
    // (36_Sprint_4_Review.md m-02: the previous version of this test never
    // actually exercised handleAnalyzerJob for the transition it claimed to
    // verify).
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');
    const storageThatNeverReturnsAStream: TemporaryObjectStorage = {
      putObject: (params) => deps.storage.putObject(params),
      exists: (key) => deps.storage.exists(key),
      deleteObject: (key) => deps.storage.deleteObject(key),
      getObjectStream: async () => {
        throw new Error('fault injected: stop right after markProcessing, before the Analyzer runs');
      },
    };
    const depsThatStallBeforeAnalyzing: WorkerDeps = { ...deps, storage: storageThatNeverReturnsAStream };

    await expect(handleAnalyzerJob(fakeJob(analysisId), depsThatStallBeforeAnalyzing)).rejects.toThrow();

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzing'); // CAS did claim it

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.status).toBe('processing'); // set by handleAnalyzerJob itself, not a manual call
  });

  it('T-06/T-17: a Raw Log delete failure leaves the ObservationSet valid and enqueues a retry', async () => {
    const { analysisId } = await setUpUploadedAnalysis(deps, 'valid.log');

    const failingStorage: TemporaryObjectStorage = {
      putObject: (params) => deps.storage.putObject(params),
      getObjectStream: (key) => deps.storage.getObjectStream(key),
      exists: (key) => deps.storage.exists(key),
      deleteObject: async () => {
        throw new StorageError('TRANSIENT', 'simulated delete failure');
      },
    };
    const depsWithFailingDelete: WorkerDeps = { ...deps, storage: failingStorage };

    await handleAnalyzerJob(fakeJob(analysisId), depsWithFailingDelete);

    const analysis = await new PrismaAnalysisRepository(deps.prisma).findById(analysisId);
    expect(analysis?.status).toBe('analyzer_result_ready');

    const observationSet = await new PrismaObservationSetRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(observationSet).not.toBeNull(); // T-06 — still valid despite the delete failure

    const uploadedAccessLog = await new PrismaUploadedAccessLogRepository(deps.prisma).findByAnalysisId(analysisId);
    expect(uploadedAccessLog?.deletionStatus).toBe('failed');
    expect(uploadedAccessLog?.status).not.toBe('deleted');

    const retryJob = await deps.maintenanceQueue.getJob(buildRawLogDeleteJobId(analysisId));
    expect(retryJob).toBeDefined(); // T-17 — a real job landed on the maintenance queue
  });
});
