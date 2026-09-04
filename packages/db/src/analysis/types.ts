import type { Analysis, AnalysisMetadata, AnalyzerStatus } from '@polaris/domain';

export interface CreateAnalysisPersistenceInput {
  projectId: string;
}

export interface UpdateAnalysisPersistenceFields {
  analyzerStatus?: AnalyzerStatus;
  metadata?: Partial<AnalysisMetadata>;
}

/**
 * Analysis + the fields the Analysis List screen needs
 * (39_Development_Setup_and_Fifth_Sprint.md §19) computed in the same
 * single query as the list itself — never a per-row follow-up query.
 * `originalFileName`/`fileSizeBytes` come from UploadedAccessLog (the real
 * source of truth — Analysis.metadata is never populated by the Worker).
 * `requestCount` is `undefined` until an ObservationSet exists, rendered
 * as `—` by the frontend.
 */
export interface AnalysisListItem extends Analysis {
  originalFileName?: string;
  fileSizeBytes?: number;
  requestCount?: number;
}
