export interface ParsedRequestLine {
  method?: string;
  path?: string;
  query?: string;
}

/**
 * Splits the quoted request field ("GET /a?b=1 HTTP/1.1") into method/path/query.
 * `-` is the standard marker for "no request captured" and is not an error;
 * anything else that isn't exactly `METHOD TARGET PROTOCOL` is malformed.
 */
export function parseRequestLine(raw: string): ParsedRequestLine | 'empty' | 'malformed' {
  if (raw === '' || raw === '-') {
    return 'empty';
  }
  const parts = raw.split(' ');
  if (parts.length !== 3) {
    return 'malformed';
  }
  const [rawMethod, target, protocol] = parts;
  if (rawMethod === undefined || target === undefined || protocol === undefined) {
    return 'malformed';
  }
  if (!protocol.startsWith('HTTP/')) {
    return 'malformed';
  }
  const method = rawMethod.toUpperCase();
  const queryIndex = target.indexOf('?');
  if (queryIndex === -1) {
    return { method, path: target };
  }
  return {
    method,
    path: target.slice(0, queryIndex),
    query: target.slice(queryIndex + 1),
  };
}
