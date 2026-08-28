import type { AccessLogParser } from './parser/types.js';
import { createDefaultParserChain, parseLine } from './parser/parser-chain.js';
import { ParseSummaryBuilder } from './summary/parse-summary-builder.js';
import type { NormalizedAccessLogEntry } from './types/normalized-entry.js';
import type { ParseSummary } from './types/parse-summary.js';

export interface ParseAccessLogResult {
  summary: ParseSummary;
  entries: NormalizedAccessLogEntry[];
}

/**
 * Sprint 1 convenience wrapper: consumes a streamed line source and returns
 * every successfully (or partially) parsed entry alongside the ParseSummary.
 * Collecting entries in memory is fine for the fixture-sized inputs this
 * sprint's tests use — real incremental aggregation that discards each line
 * after counting it lands in Sprint 2 (20_MVP_Implementation_Plan.md #8).
 */
export async function parseAccessLog(
  lines: AsyncIterable<string>,
  parsers: AccessLogParser[] = createDefaultParserChain(),
): Promise<ParseAccessLogResult> {
  const builder = new ParseSummaryBuilder();
  const entries: NormalizedAccessLogEntry[] = [];

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    const result = parseLine(line, parsers);
    builder.add(result);
    if (result.status === 'parsed' || result.status === 'partial') {
      entries.push(result.value);
    }
  }

  return { summary: builder.build(), entries };
}
