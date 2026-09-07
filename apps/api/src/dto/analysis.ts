import type { AIStatus, Analysis, AnalysisStatus, AnalyzerStatus, UploadedAccessLog } from '@polaris/domain';
import type { AnalysisListItem } from '@polaris/db';

/** Backs `GET /projects/:projectId/analyses`. */
export interface AnalysisSummaryDto {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  analyzerStatus?: AnalyzerStatus;
  /** Always present — defaults to 'not_requested' at the domain layer (decision 9). */
  aiStatus: AIStatus;
  createdAt: string;
  updatedAt: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  requestCount?: number;
}

/**
 * Backs `POST /projects/:projectId/analyses` and `GET /analyses/:analysisId`
 * — replaces Sprint 4's `reply.send(analysis)` (the raw domain object, whose
 * `metadata.originalFileName` the Worker never actually populates;
 * UploadedAccessLog is the real source of truth, 40_Sprint_5_Plan_Review.md §8).
 * Analyzed Period / Request Count come from the separate
 * `GET /analyses/:analysisId/observations` call, not duplicated here.
 */
export interface AnalysisDetailDto {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  analyzerStatus?: AnalyzerStatus;
  /** Always present — defaults to 'not_requested' at the domain layer (decision 9). */
  aiStatus: AIStatus;
  createdAt: string;
  updatedAt: string;
  originalFileName?: string;
  fileSizeBytes?: number;
}

export function toAnalysisSummaryDto(item: AnalysisListItem): AnalysisSummaryDto {
  return {
    id: item.id,
    projectId: item.projectId,
    status: item.status,
    ...(item.analyzerStatus !== undefined ? { analyzerStatus: item.analyzerStatus } : {}),
    aiStatus: item.aiStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.originalFileName !== undefined ? { originalFileName: item.originalFileName } : {}),
    ...(item.fileSizeBytes !== undefined ? { fileSizeBytes: item.fileSizeBytes } : {}),
    ...(item.requestCount !== undefined ? { requestCount: item.requestCount } : {}),
  };
}

export function toAnalysisDetailDto(analysis: Analysis, uploadedAccessLog: UploadedAccessLog | null): AnalysisDetailDto {
  return {
    id: analysis.id,
    projectId: analysis.projectId,
    status: analysis.status,
    ...(analysis.analyzerStatus !== undefined ? { analyzerStatus: analysis.analyzerStatus } : {}),
    aiStatus: analysis.aiStatus,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
    ...(uploadedAccessLog !== null ? { originalFileName: uploadedAccessLog.originalFileName } : {}),
    ...(uploadedAccessLog !== null ? { fileSizeBytes: uploadedAccessLog.sizeBytes } : {}),
  };
}
