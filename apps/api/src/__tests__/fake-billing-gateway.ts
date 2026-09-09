import type {
  BillingGateway,
  ProviderSubscriptionSnapshot,
  VerifiedBillingWebhookEvent,
} from '../billing/billing-gateway.js';

/**
 * Unlike the stateless Sprint 7 `FakeAuthAdapter`, this needs mutable state
 * — but it fakes only what a real `StripeGateway` would return FROM
 * STRIPE ITSELF. It is never a shortcut to Product Entitlement (M-01,
 * `58_Sprint_8_Plan_Review.md`) — the sole mechanism for granting an
 * Account Pro anywhere in the test suite is
 * `packages/db/src/__tests__/db-test-helpers.ts`'s `createTestSubscription`,
 * which writes the `Subscription` row directly, exactly mirroring how
 * `resolveEntitlement()` reads in production (T-BILL-16/17).
 */
export class FakeBillingGateway implements BillingGateway {
  private readonly customers = new Map<string, string>(); // accountId -> stripeCustomerId
  // providerSubscriptionId -> snapshot — used ONLY by getSubscription(),
  // the Webhook route's own canonical re-fetch. Never read by
  // requireEntitlement()/GET /billing.
  private readonly canonicalSubscriptions = new Map<string, ProviderSubscriptionSnapshot>();

  async createCustomer(accountId: string): Promise<{ stripeCustomerId: string }> {
    let stripeCustomerId = this.customers.get(accountId);
    if (stripeCustomerId === undefined) {
      stripeCustomerId = `fake-cus-${accountId}`;
      this.customers.set(accountId, stripeCustomerId);
    }
    return { stripeCustomerId };
  }

  async createCheckoutSession(): Promise<{ url: string }> {
    return { url: 'https://fake-checkout.test/session' };
  }

  async createPortalSession(): Promise<{ url: string }> {
    return { url: 'https://fake-portal.test/session' };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): VerifiedBillingWebhookEvent {
    if (signatureHeader !== 'valid-test-signature') {
      throw new Error('FakeBillingGateway: invalid test signature');
    }
    return JSON.parse(rawBody.toString('utf8')) as VerifiedBillingWebhookEvent;
  }

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionSnapshot> {
    const snapshot = this.canonicalSubscriptions.get(providerSubscriptionId);
    if (snapshot === undefined) {
      throw new Error(`FakeBillingGateway: no canonical Subscription registered for ${providerSubscriptionId}`);
    }
    return snapshot;
  }

  /**
   * Test setup for Webhook-route tests ONLY — seeds what a real Stripe API
   * re-fetch would return. Never read by requireEntitlement()/GET /billing.
   */
  setCanonicalSubscription(providerSubscriptionId: string, snapshot: ProviderSubscriptionSnapshot): void {
    this.canonicalSubscriptions.set(providerSubscriptionId, snapshot);
  }
}
