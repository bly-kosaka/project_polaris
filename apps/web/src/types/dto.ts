/**
 * Local copies of apps/api's wire DTO shapes — small and stable enough that
 * cross-app type sharing isn't worth it this sprint
 * (40_Sprint_5_Plan_Review.md discussion). The ObservationSet response is
 * the one shape validated at runtime (see api/schemas.ts) since it's far
 * larger and worth defending against drift; these DTOs are trusted as
 * coming from this repo's own backend.
 */

export type AnalysisStatus =
  | 'created'
  | 'uploaded'
  | 'analyzing'
  | 'analyzer_result_ready'
  | 'explaining'
  | 'completed'
  | 'failed';

export type AnalyzerStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed';

export type AIStatus = 'not_requested' | 'queued' | 'running' | 'success' | 'failed';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'immediate';

export type ProjectStatus = 'active' | 'archived';

export interface ProjectSummaryDto {
  id: string;
  name: string;
  analysisCount: number;
  latestAnalysisAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDto {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSummaryDto {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  analyzerStatus?: AnalyzerStatus;
  aiStatus: AIStatus;
  createdAt: string;
  updatedAt: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  requestCount?: number;
}

export interface AnalysisDetailDto {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  analyzerStatus?: AnalyzerStatus;
  aiStatus: AIStatus;
  createdAt: string;
  updatedAt: string;
  originalFileName?: string;
  fileSizeBytes?: number;
}
