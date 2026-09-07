/**
 * Raw Provider error text never crosses this boundary into a DB `errorCode`
 * column — only one of these classified codes does
 * (44_Development_Setup_and_Sixth_Sprint.md §89).
 */
export type AIProviderErrorCode =
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_RATE_LIMITED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_AUTH_FAILED'
  | 'AI_PROVIDER_INVALID_REQUEST'
  | 'AI_PROVIDER_UNSUPPORTED'
  | 'AI_INPUT_TOO_LARGE'
  | 'AI_RESPONSE_INVALID'
  | 'AI_REFERENCE_INVALID'
  | 'AI_INTERNAL_ERROR';

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;

  constructor(code: AIProviderErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AIProviderError';
    this.code = code;
  }
}

/**
 * Thrown by the Grounding Validator — never mutates/drops/"fixes" a
 * Finding or Reference, only rejects the whole result (§40).
 */
export class GroundingValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GroundingValidationError';
  }
}
