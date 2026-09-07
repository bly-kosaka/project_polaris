import type { AuthenticatedPrincipal } from '@polaris/auth';
import type { Account } from '@polaris/domain';

/**
 * Set by the global `authenticate` preHandler (F-01/F-02) before any route
 * handler runs — `req.account` is the persisted, Lazy-Provisioned Account
 * row; `req.principal` is the fresh, just-verified Auth Provider claim
 * (used by `requireVerifiedEmail`, which must read the FRESH value, never
 * the persisted `Account.emailVerified` snapshot).
 */
declare module 'fastify' {
  interface FastifyRequest {
    account: Account;
    principal: AuthenticatedPrincipal;
  }
}
