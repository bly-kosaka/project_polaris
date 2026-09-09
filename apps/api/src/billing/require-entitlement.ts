import { PrismaSubscriptionRepository } from '@polaris/db';
import { resolveEntitlement, type EffectiveEntitlement } from '@polaris/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiDeps } from '../deps.js';
import { sendApiError } from '../errors.js';

/**
 * Same shape as `require-owned-analysis.ts` — a plain async function that
 * sends its own error response and returns `undefined` on failure. Called
 * strictly AFTER Ownership (57_Development_Setup_and_Eighth_Sprint.md §32)
 * — never before, since Ownership's 404 must never be preceded by an
 * Entitlement 403 that would leak whether a non-owned resource exists.
 *
 * Reads `PrismaSubscriptionRepository` (the DB) exclusively — never
 * `FakeBillingGateway`'s own internal state in tests, and never the real
 * `StripeGateway` in production. Local Subscription Snapshot is the sole
 * Source of Truth Entitlement is ever resolved from.
 */
export async function requireEntitlement(
  deps: ApiDeps,
  req: FastifyRequest,
  reply: FastifyReply,
  feature: keyof EffectiveEntitlement['features'],
): Promise<EffectiveEntitlement | undefined> {
  const subscription = await new PrismaSubscriptionRepository(deps.prisma).findByAccountId(req.account.id);
  const entitlement = resolveEntitlement(subscription);
  if (!entitlement.features[feature]) {
    sendApiError(reply, 403, 'ENTITLEMENT_REQUIRED', 'This feature requires the Pro plan.');
    return undefined;
  }
  return entitlement;
}
