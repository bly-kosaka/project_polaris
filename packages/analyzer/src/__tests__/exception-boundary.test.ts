import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregationEngine } from '../aggregation/aggregation-engine.js';
import { analyzeAccessLog } from '../analyze.js';
import {
  AggregationError,
  ObservationSetValidationError,
  RedactionSafetyError,
  mapAnalyzerFailure,
} from '../errors.js';
import { linesFrom, SAMPLE_LOG_LINES } from './test-helpers.js';

describe('Exception boundary (F-01)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Parser Fatal resolves failed/PARSER_NO_VALID_LINES with no observationSet', async () => {
    const result = await analyzeAccessLog(linesFrom(['not a log line']));
    expect(result).toEqual({
      analyzerStatus: 'failed',
      errorCode: 'PARSER_NO_VALID_LINES',
      parseSummary: expect.any(Object),
    });
  });

  it('a throw from inside onEntry (via AggregationEngine.consume) still RESOLVES a failed result — it must never reject', async () => {
    const secretInErrorMessage = 'raw-log-line-with-token=super-secret-value-should-never-leak';
    vi.spyOn(AggregationEngine.prototype, 'consume').mockImplementation(() => {
      throw new Error(secretInErrorMessage);
    });

    // The throw happens on the very first entry, before parseAccessLogStream
    // ever resolves — so parseSummary was never produced and is correctly
    // absent, not fabricated (AnalyzeAccessLogResult's parseSummary is optional
    // for exactly this reason: 29_Sprint_2_Implementation_Plan_Final_Addendum.md §9).
    await expect(analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES))).resolves.toEqual({
      analyzerStatus: 'failed',
      errorCode: 'ANALYZER_AGGREGATION_FAILED',
    });
  });

  it('the failure result never contains the raw error message or any raw log content', async () => {
    const secretInErrorMessage = 'raw-log-line-with-token=super-secret-value-should-never-leak';
    vi.spyOn(AggregationEngine.prototype, 'consume').mockImplementation(() => {
      throw new Error(secretInErrorMessage);
    });

    const result = await analyzeAccessLog(linesFrom(SAMPLE_LOG_LINES));
    expect(JSON.stringify(result)).not.toContain('super-secret-value');
    expect(JSON.stringify(result)).not.toContain(secretInErrorMessage);
  });
});

describe('mapAnalyzerFailure classification', () => {
  it('classifies RedactionSafetyError as ANALYZER_REDACTION_SAFETY_FAILURE', () => {
    const result = mapAnalyzerFailure(new RedactionSafetyError('leak detected'), undefined);
    expect(result.errorCode).toBe('ANALYZER_REDACTION_SAFETY_FAILURE');
  });

  it('classifies ObservationSetValidationError as ANALYZER_OBSERVATION_SET_INVALID', () => {
    const result = mapAnalyzerFailure(new ObservationSetValidationError('bad shape'), undefined);
    expect(result.errorCode).toBe('ANALYZER_OBSERVATION_SET_INVALID');
  });

  it('classifies AggregationError as ANALYZER_AGGREGATION_FAILED', () => {
    const result = mapAnalyzerFailure(new AggregationError('boom'), undefined);
    expect(result.errorCode).toBe('ANALYZER_AGGREGATION_FAILED');
  });

  it('falls back to ANALYZER_INTERNAL_ERROR for an unrecognized error — never mislabeled as aggregation failure', () => {
    const result = mapAnalyzerFailure(new TypeError('something unrelated broke'), undefined);
    expect(result.errorCode).toBe('ANALYZER_INTERNAL_ERROR');
  });

  it('falls back to ANALYZER_INTERNAL_ERROR for a non-Error throw', () => {
    const result = mapAnalyzerFailure('a string was thrown, not an Error', undefined);
    expect(result.errorCode).toBe('ANALYZER_INTERNAL_ERROR');
  });

  it('never copies the raw error message into the result', () => {
    const result = mapAnalyzerFailure(new Error('sensitive-detail-abc123'), undefined);
    expect(JSON.stringify(result)).not.toContain('sensitive-detail-abc123');
  });
});
