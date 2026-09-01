import type { AIStatus, AnalysisStatus, AnalyzerStatus } from './status.js';

/**
 * Summary fields so a listing screen doesn't need to load the full
 * ObservationSet just to show an overview (13_Analysis_Data_Model.md §6).
 * Sprint 3 has no Upload/Worker to populate most of these yet — all optional.
 */
export interface AnalysisMetadata {
  originalFileName?: string;
  fileSizeBytes?: number;
  detectedLogFormat?: string;
  firstSeen?: string;
  lastSeen?: string;
  totalLineCount?: number;
  totalRequestCount?: number;
  observationSetVersion?: string;
  analyzerConfigurationVersion?: string;
  knownInformationDatasetVersion?: string;
}

export interface Analysis {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  analyzerStatus?: AnalyzerStatus;
  aiStatus: AIStatus;
  metadata: AnalysisMetadata;
  createdAt: string;
  updatedAt: string;
}
