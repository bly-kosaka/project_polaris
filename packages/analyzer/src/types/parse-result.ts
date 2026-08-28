import type { NormalizedAccessLogEntry } from './normalized-entry.js';
import type { ParseWarning } from './parse-warning.js';

export type ParseResult =
  | {
      status: 'parsed';
      value: NormalizedAccessLogEntry;
    }
  | {
      status: 'partial';
      value: NormalizedAccessLogEntry;
      warnings: ParseWarning[];
    }
  | {
      status: 'failed';
      warnings: ParseWarning[];
    };
