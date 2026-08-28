import type { ParseResult } from '../types/parse-result.js';
import type { ParseSummary } from '../types/parse-summary.js';

interface WarningTally {
  count: number;
  sample: string;
}

/**
 * Accumulates ParseResults into totals plus one aggregated entry per warning
 * code — never one record per line (26_Development_Setup_and_First_Sprint.md #42).
 */
export class ParseSummaryBuilder {
  private totalLines = 0;
  private parsedLines = 0;
  private partialLines = 0;
  private failedLines = 0;
  private readonly warningTallies = new Map<string, WarningTally>();

  add(result: ParseResult): void {
    this.totalLines += 1;
    if (result.status === 'parsed') {
      this.parsedLines += 1;
      return;
    }
    if (result.status === 'partial') {
      this.partialLines += 1;
    } else {
      this.failedLines += 1;
    }
    for (const warning of result.warnings) {
      const existing = this.warningTallies.get(warning.code);
      if (existing) {
        existing.count += 1;
      } else {
        this.warningTallies.set(warning.code, { count: 1, sample: warning.message });
      }
    }
  }

  build(): ParseSummary {
    return {
      totalLines: this.totalLines,
      parsedLines: this.parsedLines,
      partialLines: this.partialLines,
      failedLines: this.failedLines,
      warnings: Array.from(this.warningTallies.entries()).map(([code, { count, sample }]) => ({
        code,
        count,
        sample,
      })),
    };
  }
}
