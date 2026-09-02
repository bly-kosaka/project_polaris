import type { AnalysisExecution, AnalysisExecutionType } from '@polaris/domain';
import type { CreateAnalysisExecutionInput, UpdateAnalysisExecutionProgressInput } from './types.js';

/**
 * Typed lookup by (analysisId, type) — not a bare findByAnalysisId — so a
 * result is unambiguous even once AI_EXPLANATION executions exist alongside
 * ANALYZER ones for the same Analysis (35_Sprint_4_Plan_Review.md F-05).
 */
export interface AnalysisExecutionRepository {
  create(input: CreateAnalysisExecutionInput): Promise<AnalysisExecution>;
  findByAnalysisIdAndType(analysisId: string, type: AnalysisExecutionType): Promise<AnalysisExecution | null>;
  updateProgress(
    analysisId: string,
    type: AnalysisExecutionType,
    fields: UpdateAnalysisExecutionProgressInput,
  ): Promise<AnalysisExecution>;
}
