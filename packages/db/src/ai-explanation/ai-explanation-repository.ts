import type { AIExplanationRecord, CreateAIExplanationRecordInput } from './types.js';

export interface AIExplanationRepository {
  create(input: CreateAIExplanationRecordInput): Promise<AIExplanationRecord>;
  findByAnalysisId(analysisId: string): Promise<AIExplanationRecord | null>;
}
