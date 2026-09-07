import {
  AI_EXPLANATION_SCHEMA_VERSION,
  AIProviderError,
  aiExplanationModelOutputSchema,
  assignFindingIds,
  buildInitialExplanationPrompt,
  validateGrounding,
} from '@polaris/ai';
import type { AIExplanationInput } from '@polaris/ai';
import {
  PrismaAIExplanationRepository,
  PrismaAnalysisExecutionRepository,
  PrismaAnalysisRepository,
  PrismaObservationSetRepository,
  persistAiExplanationFailure,
  persistAiExplanationSuccess,
} from '@polaris/db';
import type { AIExplanationJobData } from '@polaris/queue';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { classifyAiRetryability, safeAiErrorCodeFor } from './ai-retry-classification.js';
import type { WorkerDeps } from './deps.js';

type FinalizeResult = { persisted: true } | { persisted: false; error: unknown };

/**
 * Crash-after-persist recovery for a duplicate Job delivery
 * (44_Development_Setup_and_Sixth_Sprint.md §57/§90/A6-16) — the
 * AIExplanationRecord already exists (and `persistAiExplanationSuccess`'s
 * own transaction already reconciled `Analysis.status`/`aiStatus`), so only
 * the observability-only AnalysisExecution row might still be stale. Never
 * calls the Provider again.
 */
async function reconcileAiExecutionAfterPersist(analysisId: string, deps: WorkerDeps): Promise<void> {
  try {
    const executionRepository = new PrismaAnalysisExecutionRepository(deps.prisma);
    const execution = await executionRepository.findByAnalysisIdAndType(analysisId, 'ai_explanation');
    if (execution === null) return;
    if (execution.status === 'success') return;
    await executionRepository.updateProgress(analysisId, 'ai_explanation', {
      status: 'success',
      completedAt: new Date().toISOString(),
    });
  } catch {
    // Best-effort metadata reconciliation — left for the next pass.
  }
}

async function persistAiFailureAndUpdateExecution(
  analysisId: string,
  errorCode: string,
  deps: WorkerDeps,
): Promise<FinalizeResult> {
  try {
    await persistAiExplanationFailure(deps.prisma, { analysisId });
  } catch (error) {
    return { persisted: false, error };
  }
  try {
    await new PrismaAnalysisExecutionRepository(deps.prisma).updateProgress(analysisId, 'ai_explanation', {
      status: 'failed',
      errorCode,
      completedAt: new Date().toISOString(),
    });
  } catch {
    // Left as stale observability metadata — Analysis.aiStatus is the real
    // Lifecycle source of truth and is already durably 'failed'.
  }
  return { persisted: true };
}

async function handleRetryableAiFailure(
  analysisId: string,
  errorCode: string,
  errorToThrow: unknown,
  job: Job<AIExplanationJobData>,
  deps: WorkerDeps,
): Promise<never> {
  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsStarted >= attempts) {
    await persistAiFailureAndUpdateExecution(analysisId, errorCode, deps);
  }
  throw errorToThrow;
}

async function handleNonRetryableAiFailure(
  analysisId: string,
  errorCode: string,
  job: Job<AIExplanationJobData>,
  deps: WorkerDeps,
): Promise<never> {
  const result = await persistAiFailureAndUpdateExecution(analysisId, errorCode, deps);
  if (!result.persisted) {
    return handleRetryableAiFailure(analysisId, safeAiErrorCodeFor(result.error), result.error, job, deps);
  }
  throw new UnrecoverableError(errorCode);
}

export async function handleAiExplanationJob(job: Job<AIExplanationJobData>, deps: WorkerDeps): Promise<void> {
  const { analysisId } = job.data;

  const aiExplanationRepository = new PrismaAIExplanationRepository(deps.prisma);
  const analysisRepository = new PrismaAnalysisRepository(deps.prisma);
  const observationSetRepository = new PrismaObservationSetRepository(deps.prisma);
  const executionRepository = new PrismaAnalysisExecutionRepository(deps.prisma);

  // Idempotency / Crash-after-Persist recovery — outside the failure
  // boundary below, same structural rule as handleAnalyzerJob's own
  // ObservationSet existence check.
  const existingRecord = await aiExplanationRepository.findByAnalysisId(analysisId);
  if (existingRecord !== null) {
    await reconcileAiExecutionAfterPersist(analysisId, deps);
    return;
  }

  try {
    const analysis = await analysisRepository.findById(analysisId);
    if (analysis === null) return; // nothing to do

    // Claim preconditions (§56): AnalyzerStatus must be success|partial —
    // checked before attempting any claim, since nothing else below matters
    // otherwise.
    if (analysis.analyzerStatus !== 'success' && analysis.analyzerStatus !== 'partial') return;

    // Claim — handles both the initial run (analyzer_result_ready) and a
    // Retry (completed); both are legal `-> explaining` transitions
    // (packages/db/src/status-transition.ts). Unlike the Analyzer's own
    // claim, nothing below (no Raw Log/Storage step) needs to know whether
    // this is a fresh activation or a genuine BullMQ retry.
    if (analysis.status === 'analyzer_result_ready' || analysis.status === 'completed') {
      const claimed = await analysisRepository.compareAndSetStatus(analysisId, analysis.status, 'explaining', {
        aiStatus: 'running',
      });
      if (!claimed) {
        const refreshed = await analysisRepository.findById(analysisId);
        if (!(refreshed?.status === 'explaining' && job.attemptsStarted > 1)) return;
      }
    } else if (analysis.status === 'explaining') {
      if (job.attemptsStarted <= 1) return;
    } else {
      return; // created / uploaded / analyzing / failed — AI has no business running
    }

    const observationSetRecord = await observationSetRepository.findByAnalysisId(analysisId);
    if (observationSetRecord === null) return; // nothing to explain

    // AnalysisExecution -> running, attempt incremented.
    const existingExecution = await executionRepository.findByAnalysisIdAndType(analysisId, 'ai_explanation');
    const nextAttempt = (existingExecution?.attempt ?? 0) + 1;
    if (existingExecution === null) {
      await executionRepository.create({ analysisId, type: 'ai_explanation' });
    }
    await executionRepository.updateProgress(analysisId, 'ai_explanation', {
      status: 'running',
      attempt: nextAttempt,
      startedAt: new Date().toISOString(),
    });

    // Input-size guard — real UTF-8 byte length, never `.length` (a UTF-16
    // code-unit count), since Japanese Path/User-Agent/Referrer/Known
    // Information text makes the two diverge
    // (46_Sprint_6_Plan_Final_Review.md F-02).
    const serializedObservationSet = JSON.stringify(observationSetRecord.data);
    const inputBytes = Buffer.byteLength(serializedObservationSet, 'utf8');
    if (inputBytes > deps.aiModelConfig.maxInputBytes) {
      throw new AIProviderError(
        'AI_INPUT_TOO_LARGE',
        `ObservationSet serialized size (${inputBytes} bytes) exceeds AI_MAX_INPUT_BYTES`,
      );
    }

    const input: AIExplanationInput = {
      analysisId,
      analyzerStatus: analysis.analyzerStatus,
      observationSet: observationSetRecord.data,
    };
    const prompt = buildInitialExplanationPrompt(input);

    // deps.aiProvider is an injected dependency — never resolved from the
    // Provider Registry here (46_Sprint_6_Plan_Final_Review.md F-06).
    const providerResult = await deps.aiProvider.generateExplanation({
      prompt,
      model: deps.aiModelConfig.model,
      timeoutMs: deps.aiModelConfig.timeoutMs,
      maxOutputTokens: deps.aiModelConfig.maxOutputTokens,
      ...(deps.aiModelConfig.providerOptions !== undefined
        ? { providerOptions: deps.aiModelConfig.providerOptions }
        : {}),
    });

    // Defense-in-depth double guarantee (§31) at the call-site level too —
    // never trust `output: unknown` without parsing it through this
    // package's own schema.
    const modelOutput = aiExplanationModelOutputSchema.parse(providerResult.output);
    const result = assignFindingIds(modelOutput);
    validateGrounding(result, observationSetRecord.data);

    await persistAiExplanationSuccess(deps.prisma, {
      analysisId,
      provider: providerResult.provider,
      model: providerResult.model,
      promptVersion: prompt.promptVersion,
      schemaVersion: AI_EXPLANATION_SCHEMA_VERSION,
      data: result,
      ...(providerResult.providerResponseId !== undefined
        ? { providerResponseId: providerResult.providerResponseId }
        : {}),
      ...(providerResult.usage?.inputTokens !== undefined ? { inputTokens: providerResult.usage.inputTokens } : {}),
      ...(providerResult.usage?.outputTokens !== undefined
        ? { outputTokens: providerResult.usage.outputTokens }
        : {}),
      ...(providerResult.usage?.totalTokens !== undefined ? { totalTokens: providerResult.usage.totalTokens } : {}),
    });
    await executionRepository.updateProgress(analysisId, 'ai_explanation', {
      status: 'success',
      completedAt: new Date().toISOString(),
    });
    return;
  } catch (error) {
    const errorCode = safeAiErrorCodeFor(error);
    if (classifyAiRetryability(error) === 'non-retryable') {
      return handleNonRetryableAiFailure(analysisId, errorCode, job, deps);
    }
    return handleRetryableAiFailure(analysisId, errorCode, error, job, deps);
  }
}
