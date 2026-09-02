import { ObservationSetValidationError } from '@polaris/analyzer';
import { DbError } from '@polaris/db';
import { StorageError } from '@polaris/storage';
import { describe, expect, it } from 'vitest';
import { classifyRetryability, isNonRetryableAnalyzerErrorCode, safeErrorCodeFor } from '../retry-classification.js';

describe('isNonRetryableAnalyzerErrorCode', () => {
  it.each([
    ['PARSER_NO_VALID_LINES', true],
    ['ANALYZER_INVALID_CONFIGURATION', true],
    ['ANALYZER_REDACTION_SAFETY_FAILURE', true],
    ['ANALYZER_OBSERVATION_SET_INVALID', true],
    ['PARSER_FAILED', false],
    ['ANALYZER_AGGREGATION_FAILED', false],
    ['ANALYZER_INTERNAL_ERROR', false],
  ] as const)('%s -> non-retryable=%s', (code, expected) => {
    expect(isNonRetryableAnalyzerErrorCode(code)).toBe(expected);
  });
});

describe('classifyRetryability (T-11/T-12)', () => {
  it('ObservationSetValidationError is non-retryable', () => {
    expect(classifyRetryability(new ObservationSetValidationError('bad'))).toBe('non-retryable');
  });

  it('DbError INVALID_DATA is non-retryable', () => {
    expect(classifyRetryability(new DbError('INVALID_DATA', 'bad transition'))).toBe('non-retryable');
  });

  it('DbError PERSISTENCE_FAILED is retryable', () => {
    expect(classifyRetryability(new DbError('PERSISTENCE_FAILED', 'transient'))).toBe('retryable');
  });

  it('DbError CONFLICT is retryable (a retry re-triggers the idempotency guard)', () => {
    expect(classifyRetryability(new DbError('CONFLICT', 'unique violation'))).toBe('retryable');
  });

  it('StorageError TRANSIENT is retryable', () => {
    expect(classifyRetryability(new StorageError('TRANSIENT', 'network blip'))).toBe('retryable');
  });

  it('StorageError PERMANENT is non-retryable', () => {
    expect(classifyRetryability(new StorageError('PERMANENT', 'access denied'))).toBe('non-retryable');
  });

  it('an unrecognized error defaults to retryable', () => {
    expect(classifyRetryability(new Error('mystery'))).toBe('retryable');
  });
});

describe('safeErrorCodeFor', () => {
  it('never includes the raw error message', () => {
    const secret = 'raw log line 192.0.2.1 GET /secret?token=abc123';
    const code = safeErrorCodeFor(new DbError('PERSISTENCE_FAILED', secret));
    expect(code).not.toContain(secret);
    expect(code).toBe('DB_PERSISTENCE_FAILED');
  });
});
