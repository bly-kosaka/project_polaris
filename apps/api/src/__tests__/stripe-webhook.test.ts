import { PrismaAccountRepository, PrismaBillingCustomerRepository, prisma } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { FakeBillingGateway } from './fake-billing-gateway.js';
import { buildApiDeps, resetDatabase } from './api-test-helpers.js';

/**
 * T-BILL-11..14 (`57_Development_Setup_and_Eighth_Sprint.md` §52) +
 * T-WEBHOOK-01..05 (`58_Sprint_8_Plan_Review.md` / `59_Sprint_8_Plan_Final_Review.md`
 * added regression tests). Uses `FakeBillingGateway`'s trivial
 * `verifyWebhookSignature` (a fixed test signature string, not real Stripe
 * crypto) — real signature verification is covered separately in
 * `apps/api/src/billing/__tests__/stripe-gateway.test.ts` against the real
 * SDK per §51.
 */
describe('POST /webhooks/stripe (Sprint 8)', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let billingGateway: FakeBillingGateway;
  let app: FastifyInstance;
  let accountId: string;
  let stripeCustomerId: string;

  const VALID_SIGNATURE = 'valid-test-signature';

  function postWebhook(payload: unknown, signature: string | undefined = VALID_SIGNATURE) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: Buffer.from(JSON.stringify(payload), 'utf8'),
      headers: {
        'content-type': 'application/json',
        ...(signature !== undefined ? { 'stripe-signature': signature } : {}),
      },
    });
  }

  beforeEach(async () => {
    await resetDatabase();
    billingGateway = new FakeBillingGateway();
    deps = await buildApiDeps(undefined, { billingGateway });
    app = await buildServer(deps);

    const account = await new PrismaAccountRepository(deps.prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'webhook-test-account',
      email: 'webhook-test-account@example.com',
      emailVerified: true,
    });
    accountId = account.id;
    stripeCustomerId = `cus_${account.id}`;
    await new PrismaBillingCustomerRepository(deps.prisma).create({ accountId, stripeCustomerId });
  });

  afterEach(async () => {
    await app.close();
    await deps.close();
  });

  it('T-BILL-11/T-WEBHOOK-03: an invalid signature is rejected with 400', async () => {
    const response = await postWebhook(
      { id: 'evt_1', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } },
      'not-the-right-signature',
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: expect.any(String) } });
  });

  it('T-WEBHOOK-01: a valid but unsupported event type is acknowledged with 200 and mutates nothing', async () => {
    const response = await postWebhook({ id: 'evt_2', type: 'invoice.paid', data: { object: { id: 'in_1' } } });
    expect(response.statusCode).toBe(200);

    const subscriptionCount = await prisma.subscription.count();
    const webhookEventCount = await prisma.billingWebhookEvent.count();
    expect(subscriptionCount).toBe(0);
    expect(webhookEventCount).toBe(0);
  });

  it('T-WEBHOOK-02: a valid checkout.session.completed event is acknowledged with 200 and never grants Pro', async () => {
    const response = await postWebhook({
      id: 'evt_3',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', customer: stripeCustomerId } },
    });
    expect(response.statusCode).toBe(200);

    const subscription = await prisma.subscription.findUnique({ where: { accountId } });
    expect(subscription).toBeNull();
  });

  it('T-BILL-13/T-WEBHOOK-04: a supported customer.subscription.updated event re-fetches canonical state and syncs the DB Subscription', async () => {
    billingGateway.setCanonicalSubscription('sub_100', {
      providerSubscriptionId: 'sub_100',
      stripeCustomerId,
      status: 'active',
      cancelAtPeriodEnd: false,
      providerPriceId: 'price_pro',
    });

    const response = await postWebhook({
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_100' } },
    });
    expect(response.statusCode).toBe(200);

    const subscription = await prisma.subscription.findUnique({ where: { accountId } });
    expect(subscription?.providerSubscriptionId).toBe('sub_100');
    expect(subscription?.status).toBe('active');
    expect(subscription?.providerPriceId).toBe('price_pro');
  });

  it('T-BILL-14: a customer.subscription.deleted event syncs status=canceled, and the Account becomes effectively Free', async () => {
    billingGateway.setCanonicalSubscription('sub_200', {
      providerSubscriptionId: 'sub_200',
      stripeCustomerId,
      status: 'canceled',
      cancelAtPeriodEnd: false,
    });

    const response = await postWebhook({
      id: 'evt_5',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_200' } },
    });
    expect(response.statusCode).toBe(200);

    const billingResponse = await app.inject({
      method: 'GET',
      url: '/billing',
      headers: { authorization: 'Bearer webhook-test-account' },
    });
    expect(billingResponse.json()).toMatchObject({ plan: 'free' });
  });

  it('T-BILL-12: a duplicate delivery of the same Event id is idempotent (200, no re-mutation)', async () => {
    billingGateway.setCanonicalSubscription('sub_300', {
      providerSubscriptionId: 'sub_300',
      stripeCustomerId,
      status: 'active',
      cancelAtPeriodEnd: false,
    });
    const payload = { id: 'evt_6', type: 'customer.subscription.updated', data: { object: { id: 'sub_300' } } };

    const first = await postWebhook(payload);
    expect(first.statusCode).toBe(200);

    const second = await postWebhook(payload);
    expect(second.statusCode).toBe(200);

    const webhookEventCount = await prisma.billingWebhookEvent.count({ where: { providerEventId: 'evt_6' } });
    expect(webhookEventCount).toBe(1);
    const subscriptionCount = await prisma.subscription.count({ where: { accountId } });
    expect(subscriptionCount).toBe(1);
  });

  it('T-WEBHOOK-05 (F-10): Account mapping uses the canonical stripeCustomerId, never a field read off the webhook payload', async () => {
    // A second, unrelated Account+BillingCustomer — the webhook payload
    // below deliberately names ITS customer field, but the canonical
    // getSubscription() snapshot points at the FIRST Account's Customer.
    const otherAccount = await new PrismaAccountRepository(deps.prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'other-webhook-account',
      email: 'other-webhook-account@example.com',
      emailVerified: true,
    });
    await new PrismaBillingCustomerRepository(deps.prisma).create({
      accountId: otherAccount.id,
      stripeCustomerId: 'cus_other_from_payload',
    });

    billingGateway.setCanonicalSubscription('sub_400', {
      providerSubscriptionId: 'sub_400',
      stripeCustomerId, // canonical: the FIRST account's Customer
      status: 'active',
      cancelAtPeriodEnd: false,
    });

    const response = await postWebhook({
      id: 'evt_7',
      type: 'customer.subscription.updated',
      // Payload names the OTHER account's customer — must be ignored.
      data: { object: { id: 'sub_400', customer: 'cus_other_from_payload' } },
    });
    expect(response.statusCode).toBe(200);

    const correctAccountSubscription = await prisma.subscription.findUnique({ where: { accountId } });
    expect(correctAccountSubscription?.status).toBe('active');

    const otherAccountSubscription = await prisma.subscription.findUnique({ where: { accountId: otherAccount.id } });
    expect(otherAccountSubscription).toBeNull();
  });
});
