import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockParse } = vi.hoisted(() => ({ mockParse: vi.fn() }));

vi.mock('openai', () => {
  class APIError extends Error {
    status?: number | undefined;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  }
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class BadRequestError extends APIError {}
  class UnprocessableEntityError extends APIError {}
  class InternalServerError extends APIError {}

  class MockOpenAI {
    responses = { parse: mockParse };
    static APIError = APIError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static BadRequestError = BadRequestError;
    static UnprocessableEntityError = UnprocessableEntityError;
    static InternalServerError = InternalServerError;
  }

  return { default: MockOpenAI };
});

vi.mock('openai/helpers/zod', () => ({
  zodTextFormat: (schema: unknown, name: string) => ({ type: 'json_schema', name, schema }),
}));

const { OpenAIResponsesAdapter } = await import('../provider/providers/openai/openai-responses-adapter.js');
const OpenAI = (await import('openai')).default;

// The mocked `openai` module above provides single-argument (message: string)
// constructors, not the real SDK's (status, error, message, headers) shape —
// TypeScript still resolves OpenAI.* against the real package's .d.mts, so a
// simplified constructor type is used here to match what the mock actually accepts.
interface MockErrorCtor {
  new (message: string): Error;
}
const MockOpenAI = OpenAI as unknown as Record<
  | 'APIConnectionTimeoutError'
  | 'APIConnectionError'
  | 'RateLimitError'
  | 'AuthenticationError'
  | 'PermissionDeniedError'
  | 'BadRequestError'
  | 'UnprocessableEntityError'
  | 'InternalServerError',
  MockErrorCtor
>;

function validOutputParsed() {
  return {
    summary: 'summary',
    overallUrgency: { level: 'normal', reason: 'reason', references: [], limitations: [] },
    findings: [],
    overallNotes: [],
    dataLimitations: [],
  };
}

const baseRequest = {
  prompt: { systemPrompt: 'system', userPrompt: 'user', promptVersion: 'v1' },
  model: 'test-model',
  timeoutMs: 1000,
  maxOutputTokens: 100,
};

describe('OpenAIResponsesAdapter', () => {
  afterEach(() => {
    mockParse.mockReset();
  });

  it('sends store:false, no tools key, the configured model, and a structured output format', async () => {
    mockParse.mockResolvedValue({ id: 'resp_1', output_parsed: validOutputParsed(), usage: undefined });
    const adapter = new OpenAIResponsesAdapter('test-key');
    await adapter.generateExplanation(baseRequest);

    expect(mockParse).toHaveBeenCalledTimes(1);
    const [params, options] = mockParse.mock.calls[0]!;
    expect(params.store).toBe(false);
    expect(params.model).toBe('test-model');
    expect(params.text.format).toEqual({ type: 'json_schema', name: 'ai_explanation_result', schema: expect.anything() });
    expect(params).not.toHaveProperty('tools');
    expect(options).toEqual({ timeout: 1000 });
  });

  it('includes reasoning.effort only when providerOptions.reasoningEffort is set', async () => {
    mockParse.mockResolvedValue({ id: 'resp_1', output_parsed: validOutputParsed(), usage: undefined });
    const adapter = new OpenAIResponsesAdapter('test-key');

    await adapter.generateExplanation(baseRequest);
    expect(mockParse.mock.calls[0]![0]).not.toHaveProperty('reasoning');

    await adapter.generateExplanation({ ...baseRequest, providerOptions: { reasoningEffort: 'medium' } });
    expect(mockParse.mock.calls[1]![0].reasoning).toEqual({ effort: 'medium' });
  });

  it('maps the provider response id and usage through', async () => {
    mockParse.mockResolvedValue({
      id: 'resp_42',
      output_parsed: validOutputParsed(),
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    });
    const adapter = new OpenAIResponsesAdapter('test-key');
    const result = await adapter.generateExplanation(baseRequest);

    expect(result.providerResponseId).toBe('resp_42');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(result.provider).toBe('openai');
  });

  it.each([
    [new MockOpenAI.APIConnectionTimeoutError('timeout'), 'AI_PROVIDER_TIMEOUT'],
    [new MockOpenAI.APIConnectionError('down'), 'AI_PROVIDER_UNAVAILABLE'],
    [new MockOpenAI.RateLimitError('rate limited'), 'AI_PROVIDER_RATE_LIMITED'],
    [new MockOpenAI.AuthenticationError('bad key'), 'AI_PROVIDER_AUTH_FAILED'],
    [new MockOpenAI.PermissionDeniedError('forbidden'), 'AI_PROVIDER_AUTH_FAILED'],
    [new MockOpenAI.BadRequestError('bad request'), 'AI_PROVIDER_INVALID_REQUEST'],
    [new MockOpenAI.UnprocessableEntityError('unprocessable'), 'AI_PROVIDER_INVALID_REQUEST'],
    [new MockOpenAI.InternalServerError('boom'), 'AI_PROVIDER_UNAVAILABLE'],
  ])('classifies %o as %s', async (thrown, expectedCode) => {
    mockParse.mockRejectedValue(thrown);
    const adapter = new OpenAIResponsesAdapter('test-key');
    const error = await adapter.generateExplanation(baseRequest).catch((e: unknown) => e);
    expect((error as { code: string }).code).toBe(expectedCode);
  });

  it('classifies an unrecognized error as AI_INTERNAL_ERROR', async () => {
    mockParse.mockRejectedValue(new Error('mystery failure'));
    const adapter = new OpenAIResponsesAdapter('test-key');
    const error = await adapter.generateExplanation(baseRequest).catch((e: unknown) => e);
    expect((error as { code: string }).code).toBe('AI_INTERNAL_ERROR');
  });
});
