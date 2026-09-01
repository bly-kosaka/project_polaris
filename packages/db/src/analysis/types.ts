import type { AnalysisMetadata, AnalyzerStatus } from '@polaris/domain';

export interface CreateAnalysisPersistenceInput {
  projectId: string;
}

export interface UpdateAnalysisPersistenceFields {
  analyzerStatus?: AnalyzerStatus;
  metadata?: Partial<AnalysisMetadata>;
}
