import type { AnalysisExecutionStatus, AnalysisExecutionType } from '@polaris/domain';

export interface CreateAnalysisExecutionInput {
  analysisId: string;
  type: AnalysisExecutionType;
}

export interface UpdateAnalysisExecutionProgressInput {
  status?: AnalysisExecutionStatus;
  attempt?: number;
  errorCode?: string;
  startedAt?: string;
  completedAt?: string;
}
