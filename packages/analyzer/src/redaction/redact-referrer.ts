import { redactQuery, type RedactionResult } from './redact-query.js';

/** Same redaction policy as query strings, applied to the referrer's own query portion (28 §30). */
export function redactReferrer(raw: string, sensitiveParameterNames: string[]): RedactionResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'dropped' };
  }

  const search = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  if (search.length === 0) return { kind: 'redacted', value: raw, redactedParameterNames: [] };

  const result = redactQuery(search, sensitiveParameterNames);
  if (result.kind === 'dropped') return { kind: 'dropped' };

  url.search = result.value.length > 0 ? `?${result.value}` : '';
  return { kind: 'redacted', value: url.toString(), redactedParameterNames: result.redactedParameterNames };
}
