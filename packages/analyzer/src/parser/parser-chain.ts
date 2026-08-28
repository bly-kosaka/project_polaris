import type { ParseResult } from '../types/parse-result.js';
import { COMBINED_LOG_PATTERN, COMMON_LOG_PATTERN } from './patterns.js';
import { createRegexParser } from './regex-parser.js';
import type { AccessLogParser } from './types.js';

/**
 * Combined is tried first since it's a strict superset of Common (Common's
 * pattern would otherwise also match the first part of a Combined line).
 */
export function createDefaultParserChain(): AccessLogParser[] {
  return [createRegexParser(COMBINED_LOG_PATTERN), createRegexParser(COMMON_LOG_PATTERN)];
}

export function parseLine(line: string, parsers: AccessLogParser[] = createDefaultParserChain()): ParseResult {
  for (const parser of parsers) {
    if (parser.canParse(line)) {
      return parser.parse(line);
    }
  }
  return {
    status: 'failed',
    warnings: [
      {
        code: 'PARSER_UNSUPPORTED_FORMAT',
        message: 'Line did not match any supported access log format.',
      },
    ],
  };
}
