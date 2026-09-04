import type { AnalysisStatus, AnalyzerStatus } from '../types/dto';

export interface StatusLabel {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

/**
 * Internal enum values are never shown as-is
 * (39_Development_Setup_and_Fifth_Sprint.md §10/§23/§27) — `partial` never
 * gets the same visual treatment as a clean success.
 */
export function analysisStatusLabel(status: AnalysisStatus): StatusLabel {
  switch (status) {
    case 'created':
      return { label: 'アップロード待ち', variant: 'neutral' };
    case 'uploaded':
      return { label: '解析待ち', variant: 'info' };
    case 'analyzing':
      return { label: 'ログを解析しています', variant: 'info' };
    case 'analyzer_result_ready':
      return { label: '解析結果を表示します', variant: 'success' };
    case 'explaining':
      return { label: 'AI説明を生成しています', variant: 'info' };
    case 'completed':
      return { label: '完了', variant: 'success' };
    case 'failed':
      return { label: '解析できませんでした', variant: 'danger' };
  }
}

export function analyzerStatusLabel(status: AnalyzerStatus): StatusLabel {
  switch (status) {
    case 'queued':
      return { label: '解析待ち', variant: 'neutral' };
    case 'running':
      return { label: '解析中', variant: 'info' };
    case 'success':
      return { label: '解析完了', variant: 'success' };
    case 'partial':
      return { label: '一部データに警告あり', variant: 'warning' };
    case 'failed':
      return { label: '解析できませんでした', variant: 'danger' };
  }
}
