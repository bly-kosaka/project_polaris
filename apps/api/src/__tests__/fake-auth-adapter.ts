import type { AuthAdapter, AuthenticatedPrincipal, AuthError } from '@polaris/auth';

/**
 * Mirrors `FakeAIProvider` exactly (46_Sprint_6_Plan_Final_Review.md F-06
 * precedent). Deliberately the identity function on the token itself — a
 * test authenticates "as Account A" simply by sending
 * `Authorization: Bearer account-a`, and each distinct token
 * lazy-provisions its own distinct Account row through the exact same
 * production code path (`authenticate.ts`'s hook), never a shortcut.
 */
export class FakeAuthAdapter implements AuthAdapter {
  constructor(private readonly options: { failWith?: AuthError } = {}) {}

  async verifyToken(token: string): Promise<AuthenticatedPrincipal> {
    if (this.options.failWith) throw this.options.failWith;
    // A `unverified-` prefix is the one deliberate escape hatch from the
    // "identity function" rule — it's how T-AUTH tests exercise the
    // EMAIL_VERIFICATION_REQUIRED path without a separate constructor knob.
    const emailVerified = !token.startsWith('unverified-');
    return { provider: 'clerk', subject: token, email: `${token}@example.com`, emailVerified };
  }
}
