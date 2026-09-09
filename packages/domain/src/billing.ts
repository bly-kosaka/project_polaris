export type Plan = 'free' | 'pro';

/**
 * Resolver-facing shape only — deliberately has no `stripeCustomerId` or any
 * other Stripe-identity field. Account/Customer mapping is a Gateway/webhook
 * boundary concern (`ProviderSubscriptionSnapshot`, apps/api/src/billing/),
 * never something the pure Entitlement Resolver needs to know about
 * (50_Development_Setup_and_Seventh_Sprint.md-style boundary discipline,
 * carried into Sprint 8 per 59_Sprint_8_Plan_Final_Review.md F-10).
 */
export interface SubscriptionSnapshot {
  id: string;
  accountId: string;
  provider: string;
  providerSubscriptionId: string;
  providerPriceId?: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  providerUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingCustomer {
  id: string;
  accountId: string;
  stripeCustomerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveEntitlement {
  plan: Plan;
  features: {
    aiExplanationRetry: boolean;
    // Future — never true regardless of plan until actually implemented
    // (57_Development_Setup_and_Eighth_Sprint.md §8/§35: never show an
    // unimplemented feature as "available").
    aiChat: boolean;
    reportExport: boolean;
    csvExport: boolean;
    analysisComparison: boolean;
  };
  billing: {
    status: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd?: string;
  };
}
