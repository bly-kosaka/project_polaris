/**
 * A generic, uninterpreted envelope — deliberately doesn't assume a
 * Subscription shape, since plenty of validly-signed Stripe events
 * (`checkout.session.completed`, `invoice.*`) aren't Subscription events at
 * all (59_Sprint_8_Plan_Final_Review.md M-02). Signature verification and
 * event-type interpretation are two separate steps; this is the boundary
 * between them.
 */
export interface VerifiedBillingWebhookEvent {
  id: string;
  type: string;
  data: unknown;
}

/**
 * Gateway/webhook-boundary type — deliberately distinct from
 * `@polaris/domain`'s Resolver-facing `SubscriptionSnapshot`, which has no
 * reason to carry a Stripe Customer id at all. `stripeCustomerId` is
 * REQUIRED here because it's the only thing the Webhook route is allowed to
 * resolve `accountId` from (F-10, `59_Sprint_8_Plan_Final_Review.md`) —
 * never `event.data`'s own raw payload fields.
 */
export interface ProviderSubscriptionSnapshot {
  providerSubscriptionId: string;
  stripeCustomerId: string;
  providerPriceId?: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  providerUpdatedAt?: string;
}

/**
 * Provider-neutral boundary — Stripe-API-calls only, no DB access at all
 * (m-01, `58_Sprint_8_Plan_Review.md`). `StripeGateway` (the only file in
 * this repo importing the `stripe` package) implements this against the
 * real SDK; `FakeBillingGateway` (apps/api/src/__tests__/) implements it
 * for tests, never as a shortcut to Product Entitlement (M-01) — Local
 * Subscription Snapshot, resolved via `SubscriptionRepository`, is the sole
 * Source of Truth `resolveEntitlement()` ever reads.
 */
export interface BillingGateway {
  createCustomer(accountId: string, email: string | undefined): Promise<{ stripeCustomerId: string }>;
  createCheckoutSession(params: {
    stripeCustomerId: string;
    accountId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createPortalSession(params: { stripeCustomerId: string; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): VerifiedBillingWebhookEvent;
  /** Canonical re-fetch (§26) — never trust a webhook payload's own fields. */
  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionSnapshot>;
}
