import type { AnalyzerStatus } from '@polaris/domain';
import type { ParseSummary } from '../types/parse-summary.js';

/**
 * Fatal when zero lines produced usable data, even partially
 * (07_Analyzer_Architecture.md #20: "全行Parse失敗" → Fatal).
 */
export function deriveAnalyzerStatus(summary: ParseSummary): Extract<AnalyzerStatus, 'success' | 'partial' | 'failed'> {
  if (summary.totalLines === 0) {
    return 'failed';
  }
  if (summary.parsedLines + summary.partialLines === 0) {
    return 'failed';
  }
  if (summary.partialLines > 0 || summary.failedLines > 0) {
    return 'partial';
  }
  return 'success';
}
