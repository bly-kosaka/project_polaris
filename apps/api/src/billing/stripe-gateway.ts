import Stripe from 'stripe';
import type { BillingGateway, ProviderSubscriptionSnapshot, VerifiedBillingWebhookEvent } from './billing-gateway.js';

/**
 * The ONLY file in this repo importing the `stripe` package
 * (57_Development_Setup_and_Eighth_Sprint.md §47) — a thin wrapper around
 * Stripe API calls, zero Prisma imports (m-01). No `apiVersion` is pinned
 * here — the installed SDK's own default is used rather than a guessed
 * version string (§50).
 */
export class StripeGateway implements BillingGateway {
  private readonly client: Stripe;
  private readonly webhookSecret: string;
  private readonly proPriceId: string;

  constructor(options: { secretKey: string; webhookSecret: string; proPriceId: string }) {
    this.client = new Stripe(options.secretKey);
    this.webhookSecret = options.webhookSecret;
    this.proPriceId = options.proPriceId;
  }

  async createCustomer(accountId: string, email: string | undefined): Promise<{ stripeCustomerId: string }> {
    // Account-keyed idempotency (§16) — a retried Checkout request for the
    // same Account converges on the same Stripe Customer at Stripe's own
    // level, regardless of how many times this method is called.
    const customer = await this.client.customers.create(
      { ...(email !== undefined ? { email } : {}) },
      { idempotencyKey: `polaris-customer:${accountId}` },
    );
    return { stripeCustomerId: customer.id };
  }

  async createCheckoutSession(params: {
    stripeCustomerId: string;
    accountId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: params.stripeCustomerId,
      line_items: [{ price: this.proPriceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.accountId,
      subscription_data: { metadata: { polarisAccountId: params.accountId } },
    });
    if (session.url === null) {
      throw new Error('Stripe Checkout Session was created without a hosted URL');
    }
    return { url: session.url };
  }

  async createPortalSession(params: { stripeCustomerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await this.client.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): VerifiedBillingWebhookEvent {
    // Throws Stripe.errors.StripeSignatureVerificationError on a mismatch —
    // left to propagate; the Webhook route classifies any throw here as
    // 400 WEBHOOK_SIGNATURE_INVALID.
    const event = this.client.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
    return { id: event.id, type: event.type, data: event.data };
  }

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionSnapshot> {
    const subscription = await this.client.subscriptions.retrieve(providerSubscriptionId);
    const stripeCustomerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    // current_period_end/price moved from the Subscription itself onto each
    // SubscriptionItem in this API version — confirmed against the
    // installed SDK's own types, not assumed.
    const item = subscription.items.data[0];
    return {
      providerSubscriptionId: subscription.id,
      stripeCustomerId,
      ...(item?.price.id !== undefined ? { providerPriceId: item.price.id } : {}),
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(item !== undefined ? { currentPeriodEnd: new Date(item.current_period_end * 1000).toISOString() } : {}),
    };
  }
}
