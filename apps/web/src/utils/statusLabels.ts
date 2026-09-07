import type { AIStatus, AnalysisStatus, AnalyzerStatus, UrgencyLevel } from '../types/dto';

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

/**
 * AI Explanation failure must never look like an Analyzer failure
 * (44_Development_Setup_and_Sixth_Sprint.md's hardest constraint) — 'failed'
 * here deliberately gets 'warning', never the 'danger' variant
 * analyzerStatusLabel's 'failed' case uses, and never says the analysis
 * itself failed.
 */
export function aiStatusLabel(status: AIStatus): StatusLabel {
  switch (status) {
    case 'not_requested':
      return { label: 'AI説明: 未実行', variant: 'neutral' };
    case 'queued':
      return { label: 'AI説明: 生成待ち', variant: 'neutral' };
    case 'running':
      return { label: 'AIによる説明を生成しています', variant: 'info' }; // md/44 §67 verbatim
    case 'success':
      return { label: 'AI説明: 生成完了', variant: 'success' };
    case 'failed':
      return { label: 'AIによる説明を生成できませんでした', variant: 'warning' }; // md/44 §68 verbatim
  }
}

/**
 * md/44 §17's four-level set — "どの程度早く人が確認した方がよいか" only,
 * never a Risk/Severity score. The component rendering this must still pair
 * it with an icon and the `reason` text, never color alone (§109).
 */
export function urgencyLevelLabel(level: UrgencyLevel): StatusLabel {
  switch (level) {
    case 'low':
      return { label: '急ぎではない', variant: 'neutral' };
    case 'normal':
      return { label: '通常の確認', variant: 'info' };
    case 'high':
      return { label: '早めの確認を推奨', variant: 'warning' };
    case 'immediate':
      return { label: 'すぐに確認を推奨', variant: 'warning' };
  }
}
