import { DbError, PrismaBillingCustomerRepository } from '@polaris/db';
import type { ApiDeps } from '../deps.js';

/**
 * The only place that ever calls `BillingGateway.createCustomer` from a
 * Route — DB orchestration lives here, not in the Gateway itself (m-01,
 * `58_Sprint_8_Plan_Review.md`).
 *
 * Race-hardened per F-09 (`59_Sprint_8_Plan_Final_Review.md`): two
 * concurrent first-Checkout requests for the same never-before-seen
 * Account both see `findByAccountId` return `null`, both call Stripe
 * (idempotency-keyed, so Stripe itself converges on one Customer), but the
 * DB insert itself can still lose a race — the loser catches the resulting
 * `DbError('CONFLICT')` and re-reads rather than surfacing a 500. Same
 * idiom as Sprint 7's `authenticate.ts` Account Lazy Provisioning.
 */
export async function ensureBillingCustomer(
  deps: ApiDeps,
  accountId: string,
  email: string | undefined,
): Promise<{ stripeCustomerId: string }> {
  const repository = new PrismaBillingCustomerRepository(deps.prisma);
  const existing = await repository.findByAccountId(accountId);
  if (existing !== null) return { stripeCustomerId: existing.stripeCustomerId };

  const { stripeCustomerId } = await deps.billingGateway.createCustomer(accountId, email);
  try {
    await repository.create({ accountId, stripeCustomerId });
  } catch (error) {
    if (error instanceof DbError && error.code === 'CONFLICT') {
      const winner = await repository.findByAccountId(accountId);
      if (winner !== null) return { stripeCustomerId: winner.stripeCustomerId };
    }
    // A genuine integrity error (e.g. a mismatched existing row that
    // findByAccountId somehow didn't return) is never silently swallowed.
    throw error;
  }
  return { stripeCustomerId };
}
