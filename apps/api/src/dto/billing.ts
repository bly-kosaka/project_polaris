import type { EffectiveEntitlement } from '@polaris/domain';

/** Backs `GET /billing` (57_Development_Setup_and_Eighth_Sprint.md §34). Never Stripe Secret/Customer/Subscription IDs. */
export interface BillingSummaryDto {
  plan: 'free' | 'pro';
  subscription: {
    status: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd?: string;
  };
  features: {
    aiExplanationRetry: boolean;
  };
  canManageBilling: boolean;
}

export function toBillingSummaryDto(entitlement: EffectiveEntitlement, canManageBilling: boolean): BillingSummaryDto {
  return {
    plan: entitlement.plan,
    subscription: {
      status: entitlement.billing.status,
      cancelAtPeriodEnd: entitlement.billing.cancelAtPeriodEnd,
      ...(entitlement.billing.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: entitlement.billing.currentPeriodEnd }
        : {}),
    },
    features: { aiExplanationRetry: entitlement.features.aiExplanationRetry },
    canManageBilling,
  };
}
