import { describe, expect, it } from 'vitest';
import { redactQuery } from '../redaction/redact-query.js';
import { redactReferrer } from '../redaction/redact-referrer.js';
import { DEFAULT_SENSITIVE_PARAMETER_NAMES } from '../redaction/types.js';

describe('redactQuery', () => {
  it('redacts password/token/email/session_id values', () => {
    const result = redactQuery(
      'password=hunter2&token=abc123&email=user%40example.com&session_id=xyz',
      DEFAULT_SENSITIVE_PARAMETER_NAMES,
    );
    expect(result.kind).toBe('redacted');
    if (result.kind !== 'redacted') throw new Error('unreachable');
    expect(result.value).toBe('password=[REDACTED]&token=[REDACTED]&email=[REDACTED]&session_id=[REDACTED]');
    expect(result.value).not.toContain('hunter2');
    expect(result.value).not.toContain('abc123');
  });

  it('matches parameter names case-insensitively', () => {
    const result = redactQuery('TOKEN=abc123&Email=x%40example.com', DEFAULT_SENSITIVE_PARAMETER_NAMES);
    expect(result.kind).toBe('redacted');
    if (result.kind !== 'redacted') throw new Error('unreachable');
    expect(result.value).toBe('TOKEN=[REDACTED]&Email=[REDACTED]');
  });

  it('matches the doc example exactly: q=polaris&token=abc123 -> q=polaris&token=[REDACTED]', () => {
    const result = redactQuery('q=polaris&token=abc123', DEFAULT_SENSITIVE_PARAMETER_NAMES);
    expect(result.kind).toBe('redacted');
    if (result.kind !== 'redacted') throw new Error('unreachable');
    expect(result.value).toBe('q=polaris&token=[REDACTED]');
  });

  it('leaves non-sensitive parameters untouched', () => {
    const result = redactQuery('q=polaris&page=2', DEFAULT_SENSITIVE_PARAMETER_NAMES);
    expect(result.kind).toBe('redacted');
    if (result.kind !== 'redacted') throw new Error('unreachable');
    expect(result.value).toBe('q=polaris&page=2');
    expect(result.redactedParameterNames).toEqual([]);
  });

  it('drops the sample when the parameter name has an unparseable percent-encoding, rather than guessing', () => {
    const result = redactQuery('%zz=value', DEFAULT_SENSITIVE_PARAMETER_NAMES);
    expect(result.kind).toBe('dropped');
  });
});

describe('redactReferrer', () => {
  it('redacts sensitive parameters in the referrer query string', () => {
    const result = redactReferrer(
      'https://example.com/reset?email=user@example.com&token=abc123',
      DEFAULT_SENSITIVE_PARAMETER_NAMES,
    );
    expect(result.kind).toBe('redacted');
    if (result.kind !== 'redacted') throw new Error('unreachable');
    expect(result.value).toContain('email=[REDACTED]');
    expect(result.value).toContain('token=[REDACTED]');
    expect(result.value).not.toContain('user@example.com');
    expect(result.value).not.toContain('abc123');
  });

  it('drops the sample when the referrer is not a parseable URL', () => {
    const result = redactReferrer('not a url at all', DEFAULT_SENSITIVE_PARAMETER_NAMES);
    expect(result.kind).toBe('dropped');
  });

  it('leaves a referrer with no query string untouched', () => {
    const result = redactReferrer('https://example.com/about', DEFAULT_SENSITIVE_PARAMETER_NAMES);
    expect(result.kind).toBe('redacted');
    if (result.kind !== 'redacted') throw new Error('unreachable');
    expect(result.value).toBe('https://example.com/about');
  });
});
