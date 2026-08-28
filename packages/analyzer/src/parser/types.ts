import type { ParseResult } from '../types/parse-result.js';

/**
 * Raw string fields captured by a log-format regex, before the normalizer
 * converts them into typed NormalizedAccessLogEntry values.
 */
export interface RawAccessLogFields {
  sourceIp?: string;
  timestampRaw?: string;
  requestRaw?: string;
  statusRaw?: string;
  bytesRaw?: string;
  referrer?: string;
  userAgent?: string;
}

export interface AccessLogParser {
  canParse(line: string): boolean;
  parse(line: string): ParseResult;
}
