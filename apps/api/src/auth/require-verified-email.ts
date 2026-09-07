import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { sendApiError } from '../errors.js';

/**
 * Global `preHandler` (F-04), registered right after `authenticate` —
 * every Protected Product route requires a verified email, no per-route
 * exception list. Checked against `req.principal.emailVerified` (the
 * fresh, just-verified value from THIS request), never the persisted
 * `Account.emailVerified` column, which is only ever a best-effort display
 * snapshot (50_Development_Setup_and_Seventh_Sprint.md decision 5).
 */
export function createRequireVerifiedEmailHook(): preHandlerHookHandler {
  return async function requireVerifiedEmail(req: FastifyRequest, reply: FastifyReply) {
    if (!req.principal.emailVerified) {
      return sendApiError(reply, 403, 'EMAIL_VERIFICATION_REQUIRED', 'Email verification is required');
    }
  };
}
