import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { AIProviderError, type AIProviderErrorCode } from '../../../errors.js';
import { aiExplanationModelOutputSchema } from '../../../schema.js';
import type { AIProvider } from '../../ai-provider.js';
import type { AIProviderRequest, AIProviderResult } from '../../provider-types.js';

/**
 * The only file in `packages/ai` that imports the `openai` npm package
 * (44_Development_Setup_and_Sixth_Sprint.md §12/§39). Does: build the
 * request, call `responses.parse()`, classify SDK errors, map usage. Does
 * NOT: build prompts, interpret Observations, add Findings, recompute
 * Urgency, or touch Grounding (§39).
 */
export class OpenAIResponsesAdapter implements AIProvider {
  private readonly client: OpenAI;

  constructor(apiKey?: string) {
    // Passing `undefined` lets the SDK fall back to its own OPENAI_API_KEY
    // env lookup — this class still never reads process.env itself; the
    // caller (Worker bootstrap) is the one deciding what key, if any, to
    // supply (F-04's "no direct process.env reads inside the Adapter").
    this.client = new OpenAI({ apiKey });
  }

  async generateExplanation(request: AIProviderRequest): Promise<AIProviderResult> {
    try {
      const response = await this.client.responses.parse(
        {
          model: request.model,
          input: [
            { role: 'system', content: request.prompt.systemPrompt },
            { role: 'user', content: request.prompt.userPrompt },
          ],
          text: { format: zodTextFormat(aiExplanationModelOutputSchema, 'ai_explanation_result') },
          store: false, // §32 — never left to Provider default
          max_output_tokens: request.maxOutputTokens,
          // The provider-neutral `reasoningEffort` is a plain string (md/44
          // §37's own literal type) — the cast to the SDK's own stricter
          // literal union is this Adapter's job, not provider-types.ts's.
          ...(request.providerOptions?.reasoningEffort !== undefined
            ? { reasoning: { effort: request.providerOptions.reasoningEffort as OpenAI.ReasoningEffort } }
            : {}),
          // No `tools` key at all (§33) — Sprint 6 never gives the model Web
          // Search / File Search / Code Interpreter / MCP / Functions.
        },
        { timeout: request.timeoutMs },
      );

      // Defense-in-depth double guarantee (§31): responses.parse() already
      // validated via the same Zod schema through zodTextFormat, but this
      // package re-validates explicitly rather than trusting the SDK's
      // internal parsing alone.
      const output = aiExplanationModelOutputSchema.parse(response.output_parsed);

      return {
        provider: 'openai',
        model: request.model,
        output,
        ...(response.id !== undefined ? { providerResponseId: response.id } : {}),
        usage: {
          ...(response.usage?.input_tokens !== undefined ? { inputTokens: response.usage.input_tokens } : {}),
          ...(response.usage?.output_tokens !== undefined ? { outputTokens: response.usage.output_tokens } : {}),
          ...(response.usage?.total_tokens !== undefined ? { totalTokens: response.usage.total_tokens } : {}),
        },
      };
    } catch (error) {
      throw new AIProviderError(classifyOpenAIError(error), 'OpenAI Responses API request failed', {
        cause: error,
      });
    }
  }
}

/**
 * Classifies the installed SDK's own error hierarchy — verify these
 * `instanceof` checks and `.status` codes against `openai@6.49.0`'s actual
 * exported error classes at implementation time
 * (44_Development_Setup_and_Sixth_Sprint.md's own instruction not to guess
 * API shapes; Sprint 6 Plan's "Open risks" section flags this explicitly).
 */
function classifyOpenAIError(error: unknown): AIProviderErrorCode {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return 'AI_PROVIDER_TIMEOUT';
  if (error instanceof OpenAI.APIConnectionError) return 'AI_PROVIDER_UNAVAILABLE';
  if (error instanceof OpenAI.RateLimitError) return 'AI_PROVIDER_RATE_LIMITED';
  if (error instanceof OpenAI.AuthenticationError) return 'AI_PROVIDER_AUTH_FAILED';
  if (error instanceof OpenAI.PermissionDeniedError) return 'AI_PROVIDER_AUTH_FAILED';
  if (error instanceof OpenAI.BadRequestError) return 'AI_PROVIDER_INVALID_REQUEST';
  if (error instanceof OpenAI.UnprocessableEntityError) return 'AI_PROVIDER_INVALID_REQUEST';
  if (error instanceof OpenAI.InternalServerError) return 'AI_PROVIDER_UNAVAILABLE';
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status !== undefined && status >= 500) return 'AI_PROVIDER_UNAVAILABLE';
    if (status === 429) return 'AI_PROVIDER_RATE_LIMITED';
    return 'AI_PROVIDER_INVALID_REQUEST';
  }
  if (error instanceof Error && error.name === 'ZodError') return 'AI_RESPONSE_INVALID';
  return 'AI_INTERNAL_ERROR';
}
