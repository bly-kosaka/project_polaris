export type AuthProviderId = 'clerk';

/**
 * The one thing that crosses the Authentication Boundary — never a Clerk
 * SDK type (50_Development_Setup_and_Seventh_Sprint.md §8). `emailVerified`
 * is the fresh, just-verified value from *this* token verification, not a
 * persisted snapshot — callers must treat it as the Source of Truth for any
 * verification-gated decision (apps/api's requireVerifiedEmail hook reads
 * this, never the DB `Account.emailVerified` column).
 */
export interface AuthenticatedPrincipal {
  provider: AuthProviderId;
  subject: string;
  email?: string;
  emailVerified: boolean;
}
