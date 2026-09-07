import { AIProviderError, GroundingValidationError } from '@polaris/ai';
import { DbError } from '@polaris/db';

/**
 * The AI-specific mirror of `retry-classification.ts` — a separate file
 * since the error taxonomy (Provider/Grounding errors) is unrelated to the
 * Analyzer's (Storage/DbError/AnalyzerFatalResultError)
 * (44_Development_Setup_and_Sixth_Sprint.md §40).
 */
const NON_RETRYABLE_AI_ERROR_CODES = new Set([
  'AI_PROVIDER_AUTH_FAILED',
  'AI_PROVIDER_INVALID_REQUEST',
  'AI_PROVIDER_UNSUPPORTED',
  'AI_INPUT_TOO_LARGE',
]);

export function classifyAiRetryability(error: unknown): 'retryable' | 'non-retryable' {
  if (error instanceof AIProviderError) {
    return NON_RETRYABLE_AI_ERROR_CODES.has(error.code) ? 'non-retryable' : 'retryable';
  }
  if (error instanceof GroundingValidationError) return 'retryable';
  if (error instanceof DbError) return error.code === 'INVALID_DATA' ? 'non-retryable' : 'retryable';
  return 'retryable';
}

export function safeAiErrorCodeFor(error: unknown): string {
  if (error instanceof AIProviderError) return error.code;
  if (error instanceof GroundingValidationError) return 'AI_REFERENCE_INVALID';
  if (error instanceof DbError) return `DB_${error.code}`;
  return 'AI_INTERNAL_ERROR';
}
