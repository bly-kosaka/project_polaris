import type { ParseResult } from '../types/parse-result.js';
import { normalizeFields } from '../normalizer/normalize.js';
import type { AccessLogParser, RawAccessLogFields } from './types.js';

/**
 * Builds an AccessLogParser from a single named-capture-group regex.
 * Combined and Common Log Format only differ in which groups are present,
 * so both are expressed as one regex each rather than separate parser classes.
 */
export function createRegexParser(pattern: RegExp): AccessLogParser {
  return {
    canParse(line: string): boolean {
      return pattern.test(line);
    },
    parse(line: string): ParseResult {
      const match = pattern.exec(line);
      if (!match?.groups) {
        return {
          status: 'failed',
          warnings: [
            {
              code: 'PARSER_UNSUPPORTED_FORMAT',
              message: 'Line did not match the expected access log format.',
            },
          ],
        };
      }
      const raw = match.groups as RawAccessLogFields;
      const { value, warnings } = normalizeFields(raw);
      if (warnings.length === 0) {
        return { status: 'parsed', value };
      }
      return { status: 'partial', value, warnings };
    },
  };
}
