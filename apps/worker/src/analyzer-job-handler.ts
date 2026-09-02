import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { analyzeAccessLog, BUILT_IN_KNOWN_INFORMATION_DATASET } from '@polaris/analyzer';
import {
  PrismaAnalysisExecutionRepository,
  PrismaAnalysisRepository,
  PrismaObservationSetRepository,
  PrismaProjectKnownInformationRepository,
  PrismaUploadedAccessLogRepository,
  persistAnalyzerFailure,
  persistAnalyzerSuccess,
  toKnownInformationDataset,
} from '@polaris/db';
import type { AnalyzerJobData } from '@polaris/queue';
import type { WorkerDeps } from './deps.js';
import { reconcileExecutionAfterPersist, reconcileRawLogDeletion } from './reconcile-recovery.js';
import { classifyRetryability, isNonRetryableAnalyzerErrorCode, safeErrorCodeFor } from './retry-classification.js';
import { linesFromStream } from './stream-lines.js';

/**
 * Marks the Analysis/AnalysisExecution as failed (Raw Log deleted only
 * after that persist succeeds — same ordering rule as the success path)
 * without touching BullMQ's own attempt bookkeeping; the caller decides
 * whether to throw a plain Error (BullMQ retries) or UnrecoverableError
 * (BullMQ gives up immediately, F-06).
 */
async function finalizeAsFailed(analysisId: string, errorCode: string, deps: WorkerDeps): Promise<void> {
  try {
    await persistAnalyzerFailure(deps.prisma, { analysisId });
  } catch {
    return; // best-effort — leave state for a future retry/investigation rather than compounding errors
  }
  await reconcileRawLogDeletion(analysisId, deps);
  await new PrismaAnalysisExecutionRepository(deps.prisma).updateProgress(analysisId, 'analyzer', {
    status: 'failed',
    errorCode,
    completedAt: new Date().toISOString(),
  });
}

async function handleNonRetryableFailure(analysisId: string, errorCode: string, deps: WorkerDeps): Promise<never> {
  await finalizeAsFailed(analysisId, errorCode, deps);
  throw new UnrecoverableError(errorCode); // F-06 — BullMQ moves the job to failed, no further attempts
}

/**
 * `errorToThrow` is what actually propagates to BullMQ on non-exhaustion —
 * for a real thrown exception that's the original error; for an Analyzer
 * `failed` result (no exception was thrown) it's a synthesized one carrying
 * only the classified code, never a raw message
 * (35_Sprint_4_Plan_Review.md F-08).
 */
async function handleRetryableFailure(
  analysisId: string,
  errorCode: string,
  errorToThrow: unknown,
  job: Job<AnalyzerJobData>,
  deps: WorkerDeps,
): Promise<never> {
  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsStarted >= attempts) {
    await finalizeAsFailed(analysisId, errorCode, deps);
  }
  throw errorToThrow;
}

export async function handleAnalyzerJob(job: Job<AnalyzerJobData>, deps: WorkerDeps): Promise<void> {
  const { analysisId } = job.data;

  const observationSetRepository = new PrismaObservationSetRepository(deps.prisma);
  const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
  const uploadedAccessLogRepository = new PrismaUploadedAccessLogRepository(deps.prisma);
  const executionRepository = new PrismaAnalysisExecutionRepository(deps.prisma);

  // Step 1 (decision 6 / F-03): idempotency / Crash-after-Persist recovery.
  // Never falls through past this block — structurally cannot reach
  // persistAnalyzerSuccess/Failure below once an ObservationSet exists.
  const existingObservationSet = await observationSetRepository.findByAnalysisId(analysisId);
  if (existingObservationSet !== null) {
    await reconcileRawLogDeletion(analysisId, deps);
    await reconcileExecutionAfterPersist(analysisId, deps);
    return;
  }

  const analysis = await analysisRepository.findById(analysisId);
  if (analysis === null) return; // nothing to do

  // Step 2 (F-07): CAS the uploaded->analyzing transition; a CAS loser only
  // continues as a retry candidate if this is a genuine BullMQ retry
  // (attemptsStarted > 1), never on its first activation.
  let isRetryCandidate = false;
  if (analysis.status === 'uploaded') {
    const claimed = await analysisRepository.compareAndSetStatus(analysisId, 'uploaded', 'analyzing');
    if (claimed) {
      await uploadedAccessLogRepository.markProcessing(analysisId); // F-13 / T-20
    } else {
      const refreshed = await analysisRepository.findById(analysisId);
      if (refreshed?.status === 'analyzing' && job.attemptsStarted > 1) {
        isRetryCandidate = true;
      } else {
        return;
      }
    }
  } else if (analysis.status === 'analyzing') {
    if (job.attemptsStarted > 1) {
      isRetryCandidate = true;
    } else {
      return;
    }
  } else {
    return; // created / failed / completed / analyzer_result_ready / explaining
  }

  const uploadedAccessLog = await uploadedAccessLogRepository.findByAnalysisId(analysisId);
  if (uploadedAccessLog === null) return; // invalid state — nothing to analyze

  // Step 3: a retry only proceeds if the Raw Log is still there.
  if (isRetryCandidate) {
    const stillExists = await deps.storage.exists(uploadedAccessLog.storageKey);
    if (!stillExists) return;
  }

  // Step 4: AnalysisExecution -> running, attempt incremented.
  const existingExecution = await executionRepository.findByAnalysisIdAndType(analysisId, 'analyzer');
  const nextAttempt = (existingExecution?.attempt ?? 0) + 1;
  if (existingExecution === null) {
    await executionRepository.create({ analysisId, type: 'analyzer' });
  }
  await executionRepository.updateProgress(analysisId, 'analyzer', {
    status: 'running',
    attempt: nextAttempt,
    startedAt: new Date().toISOString(),
  });

  // Step 5: Known Information — Built-in merged with this Project's
  // (disabled rows already excluded by toKnownInformationDataset).
  const projectKnownInformation = await new PrismaProjectKnownInformationRepository(deps.prisma).listByProjectId(
    analysis.projectId,
  );
  const knownInformationDataset = [
    ...BUILT_IN_KNOWN_INFORMATION_DATASET,
    ...toKnownInformationDataset(projectKnownInformation),
  ];

  // Step 6: stream the Raw Log straight into the Analyzer — never buffered.
  const stream = await deps.storage.getObjectStream(uploadedAccessLog.storageKey);
  const result = await analyzeAccessLog(linesFromStream(stream), {}, knownInformationDataset);

  // Step 7: handle the result. Narrows on `!== 'failed'` rather than
  // `=== 'success' || === 'partial'` — TS 5.5's control-flow analysis
  // narrows the complement of a single-literal branch ('failed') more
  // reliably than the union-of-two-literals branch ('success' | 'partial').
  if (result.analyzerStatus !== 'failed') {
    try {
      await persistAnalyzerSuccess(deps.prisma, {
        analysisId,
        analyzerStatus: result.analyzerStatus,
        observationSet: result.observationSet,
      });
    } catch (error) {
      const errorCode = safeErrorCodeFor(error);
      if (classifyRetryability(error) === 'non-retryable') {
        return handleNonRetryableFailure(analysisId, errorCode, deps);
      }
      return handleRetryableFailure(analysisId, errorCode, error, job, deps);
    }
    await reconcileRawLogDeletion(analysisId, deps); // F-09 on delete failure
    await executionRepository.updateProgress(analysisId, 'analyzer', {
      status: result.analyzerStatus,
      completedAt: new Date().toISOString(),
    });
    return;
  }

  // result.analyzerStatus === 'failed' — analyzeAccessLog never throws; the
  // Fatal contract already classified this into a stable AnalyzerErrorCode.
  const { errorCode } = result;
  if (isNonRetryableAnalyzerErrorCode(errorCode)) {
    return handleNonRetryableFailure(analysisId, errorCode, deps);
  }
  return handleRetryableFailure(analysisId, errorCode, new Error(errorCode), job, deps);
}
