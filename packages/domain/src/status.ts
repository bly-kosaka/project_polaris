/**
 * Top-level Analysis lifecycle. Kept separate from AnalyzerStatus so that
 * "processing stage" and "analyzer result quality" never get conflated
 * (see 20_MVP_Implementation_Plan.md #12).
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

export type RawLogDeletionStatus = 'pending' | 'success' | 'failed';
