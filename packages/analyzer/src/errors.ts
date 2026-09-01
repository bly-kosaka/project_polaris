import type { ParseSummary } from './types/parse-summary.js';

export class AnalyzerConfigValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AnalyzerConfigValidationError';
  }
}

export class AggregationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AggregationError';
  }
}

export class RedactionSafetyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RedactionSafetyError';
  }
}

export class ObservationSetValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ObservationSetValidationError';
  }
}

export type AnalyzerErrorCode =
  | 'PARSER_NO_VALID_LINES'
  | 'PARSER_FAILED'
  | 'ANALYZER_INVALID_CONFIGURATION'
  | 'ANALYZER_AGGREGATION_FAILED'
  | 'ANALYZER_REDACTION_SAFETY_FAILURE'
  | 'ANALYZER_OBSERVATION_SET_INVALID'
  | 'ANALYZER_INTERNAL_ERROR';

export interface AnalyzerFailureResult {
  analyzerStatus: 'failed';
  errorCode: AnalyzerErrorCode;
  parseSummary?: ParseSummary;
}

function classify(error: unknown): AnalyzerErrorCode {
  if (error instanceof AnalyzerConfigValidationError) return 'ANALYZER_INVALID_CONFIGURATION';
  if (error instanceof RedactionSafetyError) return 'ANALYZER_REDACTION_SAFETY_FAILURE';
  if (error instanceof ObservationSetValidationError) return 'ANALYZER_OBSERVATION_SET_INVALID';
  if (error instanceof AggregationError) return 'ANALYZER_AGGREGATION_FAILED';
  return 'ANALYZER_INTERNAL_ERROR';
}

/**
 * Never copies the raw Error.message or any raw log/query/referrer/token
 * content into the result — only the classified code and the already-safe
 * ParseSummary cross this boundary (29_Sprint_2_Implementation_Plan_Final_Addendum.md §8).
 */
export function mapAnalyzerFailure(error: unknown, parseSummary: ParseSummary | undefined): AnalyzerFailureResult {
  const errorCode = classify(error);
  return parseSummary === undefined
    ? { analyzerStatus: 'failed', errorCode }
    : { analyzerStatus: 'failed', errorCode, parseSummary };
}
