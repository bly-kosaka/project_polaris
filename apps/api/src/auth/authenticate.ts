import { AuthError } from '@polaris/auth';
import { PrismaAccountRepository } from '@polaris/db';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ApiDeps } from '../deps.js';
import { sendApiError } from '../errors.js';

/**
 * Global `preHandler` (registered once in `server.ts`, before every route
 * registrar) — the sole place a request's Authorization header is checked
 * (50_Development_Setup_and_Seventh_Sprint.md decision 5).
 */
export function createAuthenticateHook(deps: ApiDeps): preHandlerHookHandler {
  return async function authenticate(req: FastifyRequest, reply: FastifyReply) {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return sendApiError(reply, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }
    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) {
      return sendApiError(reply, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }

    let principal;
    try {
      principal = await deps.authAdapter.verifyToken(token);
    } catch (error) {
      // F-02: a Clerk/network/JWKS outage must never look like "your
      // session is invalid" — that would incorrectly bounce a validly
      // signed-in user to Sign In. Anything not our own AuthError is
      // treated the same way `ClerkAuthAdapter` treats it internally —
      // as UNAVAILABLE, the safer default.
      if (error instanceof AuthError && error.code === 'AUTHENTICATION_INVALID') {
        return sendApiError(reply, 401, 'AUTHENTICATION_INVALID', 'Your session is invalid');
      }
      return sendApiError(reply, 503, 'AUTHENTICATION_UNAVAILABLE', 'The Auth Provider is temporarily unavailable');
    }

    const accountRepository = new PrismaAccountRepository(deps.prisma);
    // Atomic Lazy Provisioning (F-01) — race-safe under concurrent
    // first-requests from the same Auth Provider subject by construction.
    let account = await accountRepository.getOrCreateByAuthSubject({
      authProvider: principal.provider,
      authSubject: principal.subject,
      ...(principal.email !== undefined ? { email: principal.email } : {}),
      emailVerified: principal.emailVerified,
    });

    // Opportunistic profile-snapshot refresh (m-02) — never load-bearing,
    // never an unhandled rejection.
    if (account.email !== principal.email || account.emailVerified !== principal.emailVerified) {
      try {
        account = await accountRepository.updateProfile(account.id, {
          ...(principal.email !== undefined ? { email: principal.email } : {}),
          emailVerified: principal.emailVerified,
        });
      } catch {
        // Best-effort only — authentication success is never contingent on this write.
      }
    }

    req.account = account;
    req.principal = principal;
  };
}
