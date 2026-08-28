/**
 * A single access log request, normalized to a common shape across parsers.
 * Any field may be missing if the source line didn't carry it (07_Analyzer_Architecture.md #6-7) —
 * missing values must stay `undefined`, never guessed.
 */
export interface NormalizedAccessLogEntry {
  timestamp?: string;
  sourceIp?: string;
  method?: string;
  path?: string;
  query?: string;
  status?: number;
  responseBytes?: number;
  referrer?: string;
  userAgent?: string;
}
