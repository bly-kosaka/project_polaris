import type { AIModelConfig } from '@polaris/ai';
import type { Env } from '@polaris/shared';

/**
 * The one place Sprint 6 reads AI_PROVIDER/OPENAI_MODEL/
 * OPENAI_REASONING_EFFORT/AI_TIMEOUT_MS/AI_MAX_OUTPUT_TOKENS/
 * AI_MAX_INPUT_BYTES from env — neither the Job Handler nor the OpenAI
 * Adapter ever reads `process.env` directly
 * (44_Development_Setup_and_Sixth_Sprint.md §85.1, 45_Sprint_6_Plan_Review.md
 * F-04). Swapping this one function for a future
 * `resolveAiModelConfigForAnalysis(analysisId, userEntitlement)` is the
 * entire migration path to per-user Provider selection.
 */
export function resolveAiModelConfig(env: Env): AIModelConfig {
  return {
    provider: env.AI_PROVIDER,
    model: env.OPENAI_MODEL ?? '',
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxInputBytes: env.AI_MAX_INPUT_BYTES,
    ...(env.OPENAI_REASONING_EFFORT !== undefined
      ? { providerOptions: { reasoningEffort: env.OPENAI_REASONING_EFFORT } }
      : { providerOptions: { reasoningEffort: 'medium' } }), // §36 default
  };
}
