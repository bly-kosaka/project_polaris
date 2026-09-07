import type { AIFinding, AIUrgencyAssessment } from '@polaris/ai';
import type { AIExplanationRecord } from '@polaris/db';

/**
 * Backs `GET /analyses/:analysisId/explanation` — the persisted result data
 * plus provenance fields (`provider`/`model`/`promptVersion`/`createdAt`).
 * Never the raw prompt or provider response (44_Development_Setup_and_Sixth_Sprint.md §44).
 */
export interface AIExplanationDetailDto {
  summary: string;
  overallUrgency: AIUrgencyAssessment;
  findings: AIFinding[];
  overallNotes: string[];
  dataLimitations: string[];
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: string;
}

export function toAIExplanationDetailDto(record: AIExplanationRecord): AIExplanationDetailDto {
  return {
    summary: record.data.summary,
    overallUrgency: record.data.overallUrgency,
    findings: record.data.findings,
    overallNotes: record.data.overallNotes,
    dataLimitations: record.data.dataLimitations,
    provider: record.provider,
    model: record.model,
    promptVersion: record.promptVersion,
    createdAt: record.createdAt,
  };
}
