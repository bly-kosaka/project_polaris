import type { AnalyzerErrorCode } from '@polaris/analyzer';
import { ObservationSetValidationError } from '@polaris/analyzer';
import { DbError } from '@polaris/db';
import { StorageError } from '@polaris/storage';

/**
 * These four are the only AnalyzerErrorCode values
 * 34_Development_Setup_and_Fourth_Sprint.md §40/§42 names as Non-retryable —
 * re-running the same Raw Log against the same config will fail identically.
 * Everything else (PARSER_FAILED, ANALYZER_AGGREGATION_FAILED,
 * ANALYZER_INTERNAL_ERROR) is treated as retryable by default: it may be
 * wrapping a transient infrastructure hiccup, and a bounded number of BullMQ
 * retries finalizing to failed on exhaustion is a safe fallback either way.
 */
const NON_RETRYABLE_ANALYZER_ERROR_CODES: ReadonlySet<AnalyzerErrorCode> = new Set([
  'PARSER_NO_VALID_LINES',
  'ANALYZER_INVALID_CONFIGURATION',
  'ANALYZER_REDACTION_SAFETY_FAILURE',
  'ANALYZER_OBSERVATION_SET_INVALID',
]);

export function isNonRetryableAnalyzerErrorCode(code: AnalyzerErrorCode): boolean {
  return NON_RETRYABLE_ANALYZER_ERROR_CODES.has(code);
}

/**
 * `analyzeAccessLog()` never throws — a Fatal outcome is a returned result,
 * not an exception. This wraps that result so the single try/catch in
 * analyzer-job-handler.ts can route it through the same
 * classify -> retry-or-finalize boundary as every other stage's real
 * exceptions (36_Sprint_4_Review.md M-01) instead of needing a separate,
 * easy-to-miss branch.
 */
export class AnalyzerFatalResultError extends Error {
  readonly errorCode: AnalyzerErrorCode;

  constructor(errorCode: AnalyzerErrorCode) {
    super(`Analyzer returned a fatal result: ${errorCode}`);
    this.name = 'AnalyzerFatalResultError';
    this.errorCode = errorCode;
  }
}

/**
 * Classifies a thrown exception (from packages/db, packages/storage, an
 * Analyzer fatal result, or an unexpected runtime error) as retryable or
 * not. Never keyed on error.message strings — always on typed error
 * codes/classes (34_Development_Setup_and_Fourth_Sprint.md §42). Any error
 * type not recognized here defaults to 'retryable' — an unexpected
 * exception is far more likely to be an infrastructure hiccup than a
 * deterministic reproduction, and a bounded number of BullMQ retries
 * finalizing to failed on exhaustion is a safe fallback either way
 * (36_Sprint_4_Review.md M-01).
 */
export function classifyRetryability(error: unknown): 'retryable' | 'non-retryable' {
  if (error instanceof AnalyzerFatalResultError) {
    return isNonRetryableAnalyzerErrorCode(error.errorCode) ? 'non-retryable' : 'retryable';
  }
  if (error instanceof ObservationSetValidationError) {
    return 'non-retryable'; // a re-run against the same input reproduces the same invalid output
  }
  if (error instanceof DbError) {
    return error.code === 'INVALID_DATA' ? 'non-retryable' : 'retryable';
  }
  if (error instanceof StorageError) {
    return error.code === 'TRANSIENT' ? 'retryable' : 'non-retryable';
  }
  return 'retryable';
}

/**
 * A small, stable code safe to pass to `UnrecoverableError` or persist as
 * AnalysisExecution.errorCode — never the raw error message
 * (34_Development_Setup_and_Fourth_Sprint.md §77).
 */
export function safeErrorCodeFor(error: unknown): string {
  if (error instanceof AnalyzerFatalResultError) return error.errorCode;
  if (error instanceof ObservationSetValidationError) return 'ANALYZER_OBSERVATION_SET_INVALID';
  if (error instanceof DbError) return `DB_${error.code}`;
  if (error instanceof StorageError) return `STORAGE_${error.code}`;
  return 'WORKER_INTERNAL_ERROR';
}
