import type { AccessLogParser } from './parser/types.js';
import { createDefaultParserChain, parseLine } from './parser/parser-chain.js';
import { ParseSummaryBuilder } from './summary/parse-summary-builder.js';
import type { NormalizedAccessLogEntry } from './types/normalized-entry.js';
import type { ParseSummary } from './types/parse-summary.js';

export interface ParseAccessLogStreamOptions {
  /**
   * Called once per successfully (or partially) parsed line. The entry is
   * not retained afterwards — a consumer that wants to keep it must copy it.
   */
  onEntry?: (entry: NormalizedAccessLogEntry) => void;
}

/**
 * Production entry point: parses a streamed line source and hands each
 * resulting entry to `onEntry` as it's produced, never accumulating entries
 * itself. This is the shape Sprint 2's incremental Aggregation Engine plugs
 * into (20_MVP_Implementation_Plan.md #8) — callers that need every entry
 * collected (tests, fixtures) should use `collectParsedEntries` instead of
 * reaching for this with a collecting closure.
 */
export async function parseAccessLogStream(
  lines: AsyncIterable<string>,
  options: ParseAccessLogStreamOptions = {},
  parsers: AccessLogParser[] = createDefaultParserChain(),
): Promise<ParseSummary> {
  const builder = new ParseSummaryBuilder();

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    const result = parseLine(line, parsers);
    builder.add(result);
    if (result.status === 'parsed' || result.status === 'partial') {
      options.onEntry?.(result.value);
    }
  }

  return builder.build();
}

export interface CollectedParseResult {
  summary: ParseSummary;
  entries: NormalizedAccessLogEntry[];
}

/**
 * Test/fixture utility only — buffers every parsed entry in memory so
 * assertions can inspect them. Never call this from production code paths;
 * use `parseAccessLogStream` with an incremental consumer instead.
 */
export async function collectParsedEntries(
  lines: AsyncIterable<string>,
  parsers: AccessLogParser[] = createDefaultParserChain(),
): Promise<CollectedParseResult> {
  const entries: NormalizedAccessLogEntry[] = [];
  const summary = await parseAccessLogStream(lines, { onEntry: (entry) => entries.push(entry) }, parsers);
  return { summary, entries };
}
