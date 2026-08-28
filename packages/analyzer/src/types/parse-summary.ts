/**
 * One warning code aggregated across every line that produced it
 * (26_Development_Setup_and_First_Sprint.md #42) — never one entry per line.
 */
export interface ParseWarningSummary {
  code: string;
  count: number;
  sample?: string;
}

export interface ParseSummary {
  totalLines: number;
  parsedLines: number;
  partialLines: number;
  failedLines: number;
  warnings: ParseWarningSummary[];
}
