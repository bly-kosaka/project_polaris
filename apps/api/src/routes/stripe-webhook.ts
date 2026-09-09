import { DbError, PrismaBillingCustomerRepository, PrismaBillingWebhookEventRepository, PrismaSubscriptionRepository } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
import type { ApiDeps } from '../deps.js';
import { sendApiError } from '../errors.js';

const SUPPORTED_SUBSCRIPTION_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Registered only in `server.ts`'s Public Scope — Stripe Signature
 * Verification is the sole protection, never Clerk Authentication (§20).
 *
 * Two-step verify-then-interpret (M-02, `59_Sprint_8_Plan_Final_Review.md`):
 * signature verification never assumes the event is a Subscription event,
 * so a validly-signed-but-unsupported event (`checkout.session.completed`,
 * `invoice.*`) is acknowledged and dropped BEFORE any attempt to read a
 * Subscription id out of its payload.
 */
export function registerStripeWebhookRoute(app: FastifyInstance, deps: ApiDeps): void {
  app.post('/webhooks/stripe', async (req, reply) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      return sendApiError(reply, 400, 'WEBHOOK_SIGNATURE_INVALID', 'Missing Stripe-Signature header');
    }

    let event;
    try {
      event = deps.billingGateway.verifyWebhookSignature(req.body as Buffer, signature);
    } catch {
      return sendApiError(reply, 400, 'WEBHOOK_SIGNATURE_INVALID', 'Invalid Stripe webhook signature');
    }

    if (!SUPPORTED_SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
      // Valid, correctly-signed, just not something Sprint 8 syncs — e.g.
      // checkout.session.completed never grants Pro on its own (§7/§24).
      return reply.code(200).send({ received: true });
    }

    const eventData = event.data as { object?: { id?: unknown } };
    const providerSubscriptionId = eventData.object?.id;
    if (typeof providerSubscriptionId !== 'string') {
      return sendApiError(reply, 400, 'WEBHOOK_SIGNATURE_INVALID', 'Malformed subscription event payload');
    }

    // Canonical re-fetch (§26) — OUTSIDE the DB transaction below. The
    // returned ProviderSubscriptionSnapshot.stripeCustomerId (F-10), never
    // any field read directly off the webhook payload, is what resolves
    // the owning Account.
    let canonical;
    try {
      canonical = await deps.billingGateway.getSubscription(providerSubscriptionId);
    } catch (error) {
      console.error('Stripe Webhook: canonical Subscription re-fetch failed', error);
      return sendApiError(reply, 502, 'WEBHOOK_UPSTREAM_UNAVAILABLE', 'Failed to re-fetch canonical Subscription state');
    }

    const billingCustomer = await new PrismaBillingCustomerRepository(deps.prisma).findByStripeCustomerId(
      canonical.stripeCustomerId,
    );
    if (billingCustomer === null) {
      // Should be structurally impossible — Checkout always creates a
      // BillingCustomer before a Subscription can exist — but never
      // silently dropped if it somehow happens.
      console.error('Stripe Webhook: no BillingCustomer found for canonical stripeCustomerId', canonical.stripeCustomerId);
      return sendApiError(reply, 502, 'WEBHOOK_UPSTREAM_UNAVAILABLE', 'No BillingCustomer for this Subscription');
    }

    try {
      await deps.prisma.$transaction(async (tx) => {
        await new PrismaBillingWebhookEventRepository(tx).create({
          provider: 'stripe',
          providerEventId: event.id,
          eventType: event.type,
        });
        await new PrismaSubscriptionRepository(tx).upsertByProviderSubscriptionId({
          accountId: billingCustomer.accountId,
          provider: 'stripe',
          providerSubscriptionId: canonical.providerSubscriptionId,
          ...(canonical.providerPriceId !== undefined ? { providerPriceId: canonical.providerPriceId } : {}),
          status: canonical.status,
          cancelAtPeriodEnd: canonical.cancelAtPeriodEnd,
          ...(canonical.currentPeriodEnd !== undefined ? { currentPeriodEnd: canonical.currentPeriodEnd } : {}),
          ...(canonical.providerUpdatedAt !== undefined ? { providerUpdatedAt: canonical.providerUpdatedAt } : {}),
        });
      });
    } catch (error) {
      if (error instanceof DbError && error.code === 'CONFLICT') {
        // Duplicate delivery of an already-processed Event (§25) —
        // idempotent 200, Subscription state left exactly as the first
        // delivery already set it.
        return reply.code(200).send({ received: true, duplicate: true });
      }
      console.error('Stripe Webhook: persistence failed', error);
      return sendApiError(reply, 502, 'WEBHOOK_UPSTREAM_UNAVAILABLE', 'Failed to persist Subscription state');
    }

    return reply.code(200).send({ received: true });
  });
}
