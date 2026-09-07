import { createClerkClient, verifyToken as clerkVerifyToken } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';
import { TokenVerificationError, TokenVerificationErrorReason } from '@clerk/backend/errors';
import { AuthError } from '../errors.js';
import type { AuthAdapter } from '../auth-adapter.js';
import type { AuthenticatedPrincipal } from '../types.js';

/**
 * `TokenVerificationError.reason` values that mean "we — or Clerk's own
 * infrastructure — temporarily failed to verify," never "this specific
 * token is bad" (50_Development_Setup_and_Seventh_Sprint.md,
 * 52_Sprint_7_Plan_Final_Review.md F-08): JWKS fetch/cache/config problems
 * and a misconfigured secret key are Provider-availability concerns, not
 * the caller's fault. Every other reason means the token itself — expired,
 * malformed, wrong signature, wrong authorized party, not yet active —
 * is genuinely invalid.
 */
const UNAVAILABLE_VERIFICATION_REASONS: ReadonlySet<string> = new Set([
  TokenVerificationErrorReason.LocalJWKMissing,
  TokenVerificationErrorReason.RemoteJWKFailedToLoad,
  TokenVerificationErrorReason.RemoteJWKInvalid,
  TokenVerificationErrorReason.RemoteJWKMissing,
  TokenVerificationErrorReason.JWKFailedToResolve,
  TokenVerificationErrorReason.JWKKidMismatch,
  TokenVerificationErrorReason.InvalidSecretKey,
]);

/**
 * The only file in the repo that imports `@clerk/backend`
 * (50_Development_Setup_and_Seventh_Sprint.md §8). Uses the package's
 * standalone `verifyToken()` (lower-level, Provider-neutral-friendlier)
 * rather than `authenticateRequest()` — Clerk's own general recommendation
 * — per `51_Sprint_7_Plan_Review.md` §11's explicit review + accept.
 */
export class ClerkAuthAdapter implements AuthAdapter {
  private readonly client: ClerkClient;
  private readonly secretKey: string;
  private readonly authorizedParties: string[];

  constructor(options: { secretKey: string; authorizedParties: string[] }) {
    this.secretKey = options.secretKey;
    this.authorizedParties = options.authorizedParties;
    this.client = createClerkClient({ secretKey: options.secretKey });
  }

  async verifyToken(token: string): Promise<AuthenticatedPrincipal> {
    let verified: Awaited<ReturnType<typeof clerkVerifyToken>>;
    try {
      verified = await clerkVerifyToken(token, {
        secretKey: this.secretKey,
        authorizedParties: this.authorizedParties,
      });
    } catch (error) {
      throw this.classifyVerificationError(error);
    }

    // Session-bound token check (F-06): `authorizedParties` alone doesn't
    // prove this is a Browser Session Token — Clerk's `verifyToken()` has no
    // `tokenType: 'session'` option, and a custom JWT could carry a matching
    // `authorizedParties` claim without being session-bound. A genuine
    // Session Token's default claims include `sid`; a custom JWT template's
    // don't. This Sprint's Authorization surface is Browser Session Auth
    // only — reject anything else, even if it verified successfully.
    if (typeof verified.sid !== 'string' || verified.sid.length === 0 || typeof verified.sub !== 'string' || verified.sub.length === 0) {
      throw new AuthError('AUTHENTICATION_INVALID', 'Token is not a session-bound Clerk token');
    }

    // Email/verification mapping (m-01): read from session claims first (in
    // case a custom Session Token template is configured), falling back to
    // exactly one `users.getUser()` call otherwise. Never assumed as a flat
    // `emailVerified` boolean on the User resource — it doesn't exist.
    const claimEmail = typeof verified.email === 'string' ? verified.email : undefined;
    const claimEmailVerified = typeof verified.email_verified === 'boolean' ? verified.email_verified : undefined;

    let email = claimEmail;
    let emailVerified = claimEmailVerified;
    if (email === undefined || emailVerified === undefined) {
      const fetched = await this.fetchPrimaryEmail(verified.sub);
      email = fetched.email;
      emailVerified = fetched.emailVerified;
    }

    return {
      provider: 'clerk',
      subject: verified.sub,
      ...(email !== undefined ? { email } : {}),
      emailVerified: emailVerified ?? false,
    };
  }

  private async fetchPrimaryEmail(userId: string): Promise<{ email?: string; emailVerified: boolean }> {
    let user: Awaited<ReturnType<ClerkClient['users']['getUser']>>;
    try {
      user = await this.client.users.getUser(userId);
    } catch (error) {
      // F-08: any users.getUser() failure here is a Provider-availability
      // problem, never "your token is invalid" — the token was already
      // verified successfully above; this is only a supplementary profile
      // lookup that happened to fail.
      throw new AuthError('AUTHENTICATION_UNAVAILABLE', 'Failed to fetch Clerk user profile', { cause: error });
    }
    const primary = user.emailAddresses.find((addr) => addr.id === user.primaryEmailAddressId);
    return {
      ...(primary?.emailAddress !== undefined ? { email: primary.emailAddress } : {}),
      emailVerified: primary?.verification?.status === 'verified',
    };
  }

  private classifyVerificationError(error: unknown): AuthError {
    if (error instanceof TokenVerificationError) {
      if (UNAVAILABLE_VERIFICATION_REASONS.has(error.reason)) {
        return new AuthError('AUTHENTICATION_UNAVAILABLE', error.message, { cause: error });
      }
      return new AuthError('AUTHENTICATION_INVALID', error.message, { cause: error });
    }
    // Anything unclassified (a raw network error, etc.) — safer to treat as
    // a transient Provider problem than to incorrectly tell a possibly-valid
    // session it's invalid.
    return new AuthError('AUTHENTICATION_UNAVAILABLE', 'Token verification failed', { cause: error });
  }
}
