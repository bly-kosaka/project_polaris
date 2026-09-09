import type { EffectiveEntitlement, SubscriptionSnapshot } from './billing.js';

/**
 * Fail Closed (57_Development_Setup_and_Eighth_Sprint.md §11-12): only
 * these three Stripe statuses grant Pro. Any other string — including a
 * Stripe status this codebase has never heard of — is simply absent from
 * this Set, so it falls through to Free by construction. There is no
 * "else" branch to forget.
 */
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Pure — no Stripe API call, no Prisma query (§30). The sole input is the
 * Account's own persisted Subscription Snapshot (or `null` if it never
 * checked out); the sole output is what the Product may do for it right
 * now. Called from `apps/api/src/billing/require-entitlement.ts` and the
 * `GET /billing` route, both of which resolve `subscription` from
 * `SubscriptionRepository` before calling this — never the other way
 * around.
 */
export function resolveEntitlement(subscription: SubscriptionSnapshot | null): EffectiveEntitlement {
  const isPro = subscription !== null && PRO_STATUSES.has(subscription.status);
  return {
    plan: isPro ? 'pro' : 'free',
    features: {
      aiExplanationRetry: isPro,
      aiChat: false,
      reportExport: false,
      csvExport: false,
      analysisComparison: false,
    },
    billing: {
      status: subscription?.status ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      ...(subscription?.currentPeriodEnd !== undefined ? { currentPeriodEnd: subscription.currentPeriodEnd } : {}),
    },
  };
}
