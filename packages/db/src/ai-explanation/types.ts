import type { AIExplanationResult } from '@polaris/ai';

export interface AIExplanationRecord {
  id: string;
  analysisId: string;
  schemaVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  data: AIExplanationResult;
  providerResponseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  createdAt: string;
}

export interface CreateAIExplanationRecordInput {
  analysisId: string;
  schemaVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  data: AIExplanationResult;
  providerResponseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
