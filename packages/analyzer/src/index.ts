export type {
  NormalizedAccessLogEntry,
  ParseWarning,
  ParseResult,
  ParseSummary,
  ParseWarningSummary,
} from './types/index.js';

export { readLines } from './streaming/read-lines.js';

export type { AccessLogParser, RawAccessLogFields } from './parser/index.js';
export {
  COMBINED_LOG_PATTERN,
  COMMON_LOG_PATTERN,
  createRegexParser,
  createDefaultParserChain,
  parseLine,
} from './parser/index.js';

export { normalizeFields } from './normalizer/index.js';
export type { NormalizeOutcome } from './normalizer/index.js';

export { ParseSummaryBuilder, deriveAnalyzerStatus } from './summary/index.js';

export { parseAccessLogStream, collectParsedEntries } from './parse-access-log.js';
export type { ParseAccessLogStreamOptions, CollectedParseResult } from './parse-access-log.js';
