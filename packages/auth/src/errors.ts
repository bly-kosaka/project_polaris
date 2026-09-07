/**
 * Two codes, deliberately never conflated (51_Sprint_7_Plan_Review.md F-02,
 * 52_Sprint_7_Plan_Final_Review.md F-08 — the split applies to *every*
 * external Clerk call an Adapter makes, not just token verification):
 *
 * - AUTHENTICATION_INVALID: the token itself is invalid/expired/malformed/
 *   wrong-party/non-session-bound — the caller's session is genuinely bad.
 * - AUTHENTICATION_UNAVAILABLE: the Auth Provider (network/JWKS/Backend API)
 *   is temporarily unreachable — the caller's session may be perfectly
 *   valid; this must never be presented as an invalid session.
 */
export type AuthErrorCode = 'AUTHENTICATION_INVALID' | 'AUTHENTICATION_UNAVAILABLE';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuthError';
    this.code = code;
  }
}
