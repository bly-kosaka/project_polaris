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
import { AnalyzerFatalResultError, classifyRetryability, safeErrorCodeFor } from './retry-classification.js';
import { linesFromStream } from './stream-lines.js';

type FinalizeResult = { persisted: true } | { persisted: false; error: unknown };

/**
 * Marks the Analysis/AnalysisExecution as failed. Returns whether the
 * persist itself succeeded — the caller must not treat a failure to
 * *record* the failure the same as the Analyzer's own result being
 * non-retryable (36_Sprint_4_Review.md C-01). Deliberately does not touch
 * the Raw Log — the two call sites below (non-retryable result vs. retry
 * exhaustion) have opposite correct answers for whether to delete it.
 */
async function persistFailureAndUpdateExecution(
  analysisId: string,
  errorCode: string,
  deps: WorkerDeps,
): Promise<FinalizeResult> {
  try {
    await persistAnalyzerFailure(deps.prisma, { analysisId });
  } catch (error) {
    return { persisted: false, error };
  }
  await new PrismaAnalysisExecutionRepository(deps.prisma).updateProgress(analysisId, 'analyzer', {
    status: 'failed',
    errorCode,
    completedAt: new Date().toISOString(),
  });
  return { persisted: true };
}

/**
 * Non-retryable Analyzer *result* (e.g. PARSER_NO_VALID_LINES): re-running
 * the same Raw Log against the same config reproduces the same fatal
 * result, so the Raw Log is deleted right after the failure persist
 * succeeds — same ordering rule as the success path
 * (34_Development_Setup_and_Fourth_Sprint.md §40).
 */
async function finalizeAsFailedAndDeleteRawLog(
  analysisId: string,
  errorCode: string,
  deps: WorkerDeps,
): Promise<FinalizeResult> {
  const result = await persistFailureAndUpdateExecution(analysisId, errorCode, deps);
  if (result.persisted) {
    await reconcileRawLogDeletion(analysisId, deps);
  }
  return result;
}

/**
 * Infrastructure-error retry exhaustion (e.g. Storage/DB kept timing out
 * through every attempt): this is not proof the Raw Log itself is bad, so —
 * unlike the non-retryable-result path above — it is deliberately *not*
 * deleted here. It's left for an operator to recover or for the Retention
 * Cleanup safety net (34_Development_Setup_and_Fourth_Sprint.md §73,
 * 36_Sprint_4_Review.md M-01's regression-test expectation).
 */
async function finalizeAsFailedRetainingRawLog(
  analysisId: string,
  errorCode: string,
  deps: WorkerDeps,
): Promise<FinalizeResult> {
  return persistFailureAndUpdateExecution(analysisId, errorCode, deps);
}

/**
 * `errorToThrow` is what actually propagates to BullMQ on non-exhaustion —
 * for a real thrown exception that's the original error; for an Analyzer
 * `failed` result it's the synthesized AnalyzerFatalResultError, never a raw
 * message (35_Sprint_4_Plan_Review.md F-08).
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
    // Best-effort at exhaustion — if this also fails there is nothing
    // further this attempt can do; the thrown error below still reaches
    // BullMQ so the job itself lands in `failed`.
    await finalizeAsFailedRetainingRawLog(analysisId, errorCode, deps);
  }
  throw errorToThrow;
}

/**
 * The Analyzer's own result is non-retryable — but persisting *that* result
 * is a separate DB write that can still hit a transient infrastructure
 * problem of its own. Converting straight to UnrecoverableError before that
 * write durably succeeds would strand the Analysis at `analyzing` forever
 * with a permanently-failed BullMQ job and no further attempts
 * (36_Sprint_4_Review.md C-01) — so a persist failure here is routed through
 * the retryable path instead, which rethrows the DB error and lets BullMQ
 * retry the whole job (the next attempt reaches the same fatal Analyzer
 * result and tries the persist again).
 */
async function handleNonRetryableFailure(
  analysisId: string,
  errorCode: string,
  job: Job<AnalyzerJobData>,
  deps: WorkerDeps,
): Promise<never> {
  const result = await finalizeAsFailedAndDeleteRawLog(analysisId, errorCode, deps);
  if (!result.persisted) {
    return handleRetryableFailure(analysisId, safeErrorCodeFor(result.error), result.error, job, deps);
  }
  throw new UnrecoverableError(errorCode); // F-06 — BullMQ moves the job to failed, no further attempts
}

export async function handleAnalyzerJob(job: Job<AnalyzerJobData>, deps: WorkerDeps): Promise<void> {
  const { analysisId } = job.data;

  const observationSetRepository = new PrismaObservationSetRepository(deps.prisma);
  const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
  const uploadedAccessLogRepository = new PrismaUploadedAccessLogRepository(deps.prisma);
  const executionRepository = new PrismaAnalysisExecutionRepository(deps.prisma);

  // Step 1 (decision 6 / F-03): idempotency / Crash-after-Persist recovery.
  // Deliberately outside the failure boundary below — there's no Analyzer
  // failure to classify/finalize on this path, and it must never fall
  // through to persistAnalyzerSuccess/Failure once an ObservationSet exists.
  const existingObservationSet = await observationSetRepository.findByAnalysisId(analysisId);
  if (existingObservationSet !== null) {
    await reconcileRawLogDeletion(analysisId, deps);
    await reconcileExecutionAfterPersist(analysisId, deps);
    return;
  }

  // Steps 2-7 (Claim / Load / Storage Read / Analyzer / Persist) share one
  // failure boundary: any thrown error — a real exception from any stage,
  // or the synthesized AnalyzerFatalResultError below — is classified and
  // routed the same way. Before this, only the two specific catch sites
  // (persistAnalyzerSuccess, the Analyzer 'failed' result) went through
  // classification; an infra hiccup in an earlier stage (e.g.
  // storage.getObjectStream, a repository call) bypassed retry-exhaustion
  // finalization entirely and could leave Analysis/AnalysisExecution stuck
  // mid-flight forever once BullMQ gave up (36_Sprint_4_Review.md M-01).
  try {
    const analysis = await analysisRepository.findById(analysisId);
    if (analysis === null) return; // nothing to do

    // Step 2 (F-07): CAS the uploaded->analyzing transition; a CAS loser
    // only continues as a retry candidate if this is a genuine BullMQ retry
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

    // Step 7: handle the result.
    if (result.analyzerStatus !== 'failed') {
      await persistAnalyzerSuccess(deps.prisma, {
        analysisId,
        analyzerStatus: result.analyzerStatus,
        observationSet: result.observationSet,
      });
      await reconcileRawLogDeletion(analysisId, deps); // F-09 on delete failure, never throws
      await executionRepository.updateProgress(analysisId, 'analyzer', {
        status: result.analyzerStatus,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // result.analyzerStatus === 'failed' — analyzeAccessLog never throws;
    // synthesize an error so this flows through the catch below like every
    // other stage's failures.
    throw new AnalyzerFatalResultError(result.errorCode);
  } catch (error) {
    const errorCode = safeErrorCodeFor(error);
    if (classifyRetryability(error) === 'non-retryable') {
      return handleNonRetryableFailure(analysisId, errorCode, job, deps);
    }
    return handleRetryableFailure(analysisId, errorCode, error, job, deps);
  }
}
