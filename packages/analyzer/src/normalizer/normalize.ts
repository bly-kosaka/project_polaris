import type { RawAccessLogFields } from '../parser/types.js';
import type { NormalizedAccessLogEntry } from '../types/normalized-entry.js';
import type { ParseWarning } from '../types/parse-warning.js';
import { parseAccessLogTimestamp } from './timestamp.js';
import { parseRequestLine } from './request-line.js';

export interface NormalizeOutcome {
  value: NormalizedAccessLogEntry;
  warnings: ParseWarning[];
}

function hasValue(raw: string | undefined): raw is string {
  return raw !== undefined && raw !== '' && raw !== '-';
}

/**
 * Converts parser-specific raw field strings into a NormalizedAccessLogEntry
 * (07_Analyzer_Architecture.md #7). `-` / empty values are the standard
 * "not captured" marker and are silently omitted, never treated as a warning.
 */
export function normalizeFields(raw: RawAccessLogFields): NormalizeOutcome {
  const warnings: ParseWarning[] = [];
  const value: NormalizedAccessLogEntry = {};

  if (hasValue(raw.sourceIp)) {
    value.sourceIp = raw.sourceIp;
  }

  if (hasValue(raw.timestampRaw)) {
    const timestamp = parseAccessLogTimestamp(raw.timestampRaw);
    if (timestamp) {
      value.timestamp = timestamp;
    } else {
      warnings.push({
        code: 'INVALID_TIMESTAMP',
        message: 'Timestamp did not match the expected access log format.',
        field: 'timestamp',
      });
    }
  }

  if (hasValue(raw.requestRaw)) {
    const request = parseRequestLine(raw.requestRaw);
    if (request === 'malformed') {
      warnings.push({
        code: 'MALFORMED_REQUEST_LINE',
        message: 'Request line was not in "METHOD TARGET PROTOCOL" form.',
        field: 'method',
      });
    } else if (request !== 'empty') {
      if (request.method) value.method = request.method;
      if (request.path) value.path = request.path;
      if (request.query) value.query = request.query;
    }
  }

  if (hasValue(raw.statusRaw)) {
    const status = Number(raw.statusRaw);
    if (Number.isInteger(status)) {
      value.status = status;
    } else {
      warnings.push({
        code: 'INVALID_STATUS',
        message: 'Status code was not numeric.',
        field: 'status',
      });
    }
  }

  if (hasValue(raw.bytesRaw)) {
    const bytes = Number(raw.bytesRaw);
    if (Number.isInteger(bytes)) {
      value.responseBytes = bytes;
    } else {
      warnings.push({
        code: 'INVALID_RESPONSE_BYTES',
        message: 'Response size was not numeric.',
        field: 'responseBytes',
      });
    }
  }

  if (hasValue(raw.referrer)) {
    value.referrer = raw.referrer;
  }

  if (hasValue(raw.userAgent)) {
    value.userAgent = raw.userAgent;
  }

  return { value, warnings };
}
