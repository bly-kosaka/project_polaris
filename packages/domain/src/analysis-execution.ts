/**
 * `ai_explanation` is unused until the AI sprint — the type exists now so
 * AnalysisExecution's `@@unique([analysisId, type])` DB constraint doesn't
 * need a schema change to accommodate it later
 * (34_Development_Setup_and_Fourth_Sprint.md §74-77, F-05).
 */
export type AnalysisExecutionType = 'analyzer' | 'ai_explanation';

export type AnalysisExecutionStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed';

/**
 * One mutable record per (analysisId, type) — updated in place across
 * retries (`attempt` incremented), never one row per attempt.
 */
export interface AnalysisExecution {
  id: string;
  analysisId: string;
  type: AnalysisExecutionType;
  status: AnalysisExecutionStatus;
  attempt: number;
  errorCode?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}
