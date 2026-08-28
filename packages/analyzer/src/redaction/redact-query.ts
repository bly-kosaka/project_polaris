export type RedactionResult =
  | { kind: 'redacted'; value: string; redactedParameterNames: string[] }
  | { kind: 'dropped' };

/**
 * Case-insensitive parameter-name match, value replaced with [REDACTED].
 * A query we can't confidently decode is dropped entirely rather than
 * reconstructed and risked (28 §29).
 */
export function redactQuery(raw: string, sensitiveParameterNames: string[]): RedactionResult {
  if (raw.length === 0) return { kind: 'redacted', value: raw, redactedParameterNames: [] };

  const sensitiveSet = new Set(sensitiveParameterNames.map((name) => name.toLowerCase()));
  const parts = raw.split('&');
  const rebuilt: string[] = [];
  const redactedParameterNames: string[] = [];

  for (const part of parts) {
    if (part.length === 0) {
      rebuilt.push(part);
      continue;
    }
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) {
      rebuilt.push(part);
      continue;
    }
    const key = part.slice(0, eqIndex);
    let decodedKey: string;
    try {
      decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
    } catch {
      return { kind: 'dropped' };
    }
    if (sensitiveSet.has(decodedKey.toLowerCase())) {
      rebuilt.push(`${key}=[REDACTED]`);
      redactedParameterNames.push(decodedKey.toLowerCase());
    } else {
      rebuilt.push(part);
    }
  }

  return { kind: 'redacted', value: rebuilt.join('&'), redactedParameterNames };
}
