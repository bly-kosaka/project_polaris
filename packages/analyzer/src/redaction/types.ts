/** Per 28_Development_Setup_and_Second_Sprint.md §28. */
export const DEFAULT_SENSITIVE_PARAMETER_NAMES = [
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'session',
  'session_id',
  'sid',
  'email',
  'mail',
  'phone',
  'tel',
];

export interface RedactionConfig {
  sensitiveParameterNames: string[];
}

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  sensitiveParameterNames: DEFAULT_SENSITIVE_PARAMETER_NAMES,
};

export interface RedactionSummary {
  appliedParameterNames: string[];
  redactedQuerySampleCount: number;
  redactedReferrerSampleCount: number;
  droppedQuerySampleCount: number;
  droppedReferrerSampleCount: number;
}
