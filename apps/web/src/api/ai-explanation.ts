import { apiFetch } from './client';
import { aiExplanationDetailSchema, type AIExplanationDetailDto } from './ai-explanation-schema';

export class AIExplanationParseError extends Error {
  constructor(cause: unknown) {
    super('The AI Explanation response did not match the expected shape');
    this.name = 'AIExplanationParseError';
    this.cause = cause;
  }
}

export async function getAiExplanation(analysisId: string): Promise<AIExplanationDetailDto> {
  const raw = await apiFetch<unknown>(`/analyses/${encodeURIComponent(analysisId)}/explanation`);
  const result = aiExplanationDetailSchema.safeParse(raw);
  if (!result.success) {
    throw new AIExplanationParseError(result.error);
  }
  return result.data;
}

export async function retryAiExplanation(analysisId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/analyses/${encodeURIComponent(analysisId)}/explanation/retry`, {
    method: 'POST',
  });
}
