import { AIProviderError } from '../errors.js';
import type { AIProvider } from './ai-provider.js';
import type { AIProviderId } from './provider-types.js';
import { OpenAIResponsesAdapter } from './providers/openai/openai-responses-adapter.js';

/**
 * Sprint 6 resolves exactly one real Provider. `'anthropic'`/`'google'`
 * fail loudly rather than falling back to a stub adapter
 * (44_Development_Setup_and_Sixth_Sprint.md §35). Called exactly once, at
 * Worker bootstrap (`apps/worker/src/index.ts`) — never from inside the Job
 * Handler itself, so a Fake Provider can be substituted for
 * `WorkerDeps.aiProvider` in tests without this registry ever running.
 */
export interface SelectProviderOptions {
  /** Passed straight through to the OpenAI SDK client — never read from process.env by this package itself. */
  apiKey?: string;
}

export function selectProvider(providerId: AIProviderId, options: SelectProviderOptions = {}): AIProvider {
  if (providerId === 'openai') {
    return new OpenAIResponsesAdapter(options.apiKey);
  }
  throw new AIProviderError('AI_PROVIDER_UNSUPPORTED', `Provider "${providerId}" is not supported in Sprint 6`);
}
