import type { PromptDocument } from '../types.js';

/**
 * Sprint 6 only ever resolves to `'openai'` — requesting any other value
 * fails with `AI_PROVIDER_UNSUPPORTED` (registry.ts), never a stub adapter
 * (44_Development_Setup_and_Sixth_Sprint.md §35).
 */
export type AIProviderId = 'openai' | 'anthropic' | 'google';

/**
 * The "Product state" the future user-selection UI persists — never
 * Provider-specific option shapes (those live in `providerOptions` below).
 * Provider changes only ever affect *how* an Analysis is explained, never
 * the Analyzer's own output (§29/§85.1).
 */
export interface AIProviderSelection {
  provider: AIProviderId;
  model: string;
}

export interface OpenAIProviderOptions {
  reasoningEffort?: string;
}

/**
 * Provider-neutral execution config — OpenAI-specific knobs (reasoning
 * effort, store, structured-output transport) stay inside
 * `providerOptions`/the OpenAI Adapter itself, never leak into this shape
 * (§37).
 */
export interface AIModelConfig {
  provider: AIProviderId;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Sprint-6-specific addition alongside maxOutputTokens — same class of hard I/O ceiling. */
  maxInputBytes: number;
  providerOptions?: OpenAIProviderOptions;
}

export interface AIProviderRequest {
  prompt: PromptDocument;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  providerOptions?: OpenAIProviderOptions;
}

/**
 * `output` is deliberately `unknown` — the Adapter's own job is only to
 * fetch a Structured Output and hand it back; validating it against
 * `aiExplanationModelOutputSchema` is the caller's (Job Handler's)
 * responsibility, not the Adapter's (§38-39: Adapters never interpret the
 * Observation, never add Findings, never touch Grounding).
 */
export interface AIProviderResult {
  provider: AIProviderId;
  model: string;
  output: unknown;
  providerResponseId?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}
