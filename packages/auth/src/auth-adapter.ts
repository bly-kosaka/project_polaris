import type { AuthenticatedPrincipal } from './types.js';

/**
 * The one boundary every Auth Provider Adapter implements — apps/api's
 * Authentication Glue depends only on this interface, never on `@clerk/backend`
 * or any other Auth Provider SDK directly (50_Development_Setup_and_Seventh_Sprint.md §8).
 * Throws `AuthError` (never resolves with a null/undefined principal) on any
 * failure — see errors.ts for the AUTHENTICATION_INVALID / AUTHENTICATION_UNAVAILABLE split.
 */
export interface AuthAdapter {
  verifyToken(token: string): Promise<AuthenticatedPrincipal>;
}
