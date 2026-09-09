import { PrismaAccountRepository, prisma } from '@polaris/db';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { FakeBillingGateway } from './fake-billing-gateway.js';
import { buildApiDeps, resetDatabase } from './api-test-helpers.js';

const AUTH = { authorization: 'Bearer test-account' };

/**
 * The SOLE mechanism, anywhere in the test suite, for granting an Account
 * Pro (M-01, `58_Sprint_8_Plan_Review.md`) — writes the `Subscription` row
 * directly via Prisma, mirroring `packages/db/src/__tests__/db-test-helpers.ts`'s
 * own `createTestSubscription` (not cross-imported across the package
 * boundary — apps/api's tests reach Prisma directly, same as every other
 * test in this file). Never routed through `FakeBillingGateway`.
 */
async function createTestSubscription(accountId: string, status: string): Promise<void> {
  await prisma.subscription.create({
    data: {
      accountId,
      provider: 'stripe',
      providerSubscriptionId: `test-sub-${accountId}-${Date.now()}-${Math.random()}`,
      status,
      cancelAtPeriodEnd: false,
    },
  });
}

/**
 * `50_Development_Setup_and_Seventh_Sprint.md` / `57_Development_Setup_and_Eighth_Sprint.md`
 * §52 test matrix (T-BILL-01..10/15/16/17/18) plus the two Plan Review
 * rounds' added regression tests (T-BILL-16/17/18). T-BILL-06/07/08 (the AI
 * Retry Entitlement Gate) and T-BILL-11..14 (the Webhook) live in
 * `ai-explanation.test.ts` and `stripe-webhook.test.ts` respectively.
 */
describe('Billing (Sprint 8)', () => {
  let deps: Awaited<ReturnType<typeof buildApiDeps>>;
  let app: FastifyInstance;
  let ownerAccountId: string;

  beforeEach(async () => {
    await resetDatabase();
    deps = await buildApiDeps();
    app = await buildServer(deps);
    const account = await new PrismaAccountRepository(deps.prisma).getOrCreateByAuthSubject({
      authProvider: 'clerk',
      authSubject: 'test-account',
      email: 'test-account@example.com',
      emailVerified: true,
    });
    ownerAccountId = account.id;
  });

  afterEach(async () => {
    await app.close();
    await deps.close();
  });

  it('T-BILL-01: a Free Account (no Subscription row) reports plan=free', async () => {
    const response = await app.inject({ method: 'GET', url: '/billing', headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ plan: 'free', features: { aiExplanationRetry: false } });
  });

  it.each(['active', 'trialing', 'past_due'])('T-BILL-02/03/04: a Subscription with status=%s reports plan=pro', async (status) => {
    await createTestSubscription(ownerAccountId, status);
    const response = await app.inject({ method: 'GET', url: '/billing', headers: AUTH });
    expect(response.json()).toMatchObject({ plan: 'pro', features: { aiExplanationRetry: true } });
  });

  it.each(['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'a-future-unknown-status'])(
    'T-BILL-05: a Subscription with status=%s Fail Closes to plan=free',
    async (status) => {
      await createTestSubscription(ownerAccountId, status);
      const response = await app.inject({ method: 'GET', url: '/billing', headers: AUTH });
      expect(response.json()).toMatchObject({ plan: 'free', features: { aiExplanationRetry: false } });
    },
  );

  it('T-BILL-16: FakeBillingGateway-side "active" state, with no DB Subscription row, still reports free', async () => {
    // The Gateway's own internal state is never a shortcut to Entitlement
    // (M-01) — seed a canonical snapshot as if Stripe itself thinks this
    // Account is active, without ever letting a webhook persist it to DB.
    const billingGateway = new FakeBillingGateway();
    billingGateway.setCanonicalSubscription('sub_never_synced', {
      providerSubscriptionId: 'sub_never_synced',
      stripeCustomerId: 'cus_never_synced',
      status: 'active',
      cancelAtPeriodEnd: false,
    });
    const localDeps = await buildApiDeps(undefined, { billingGateway });
    const localApp = await buildServer(localDeps);
    try {
      const account = await new PrismaAccountRepository(localDeps.prisma).getOrCreateByAuthSubject({
        authProvider: 'clerk',
        authSubject: 'test-account',
        email: 'test-account@example.com',
        emailVerified: true,
      });
      expect(account.id).toBe(ownerAccountId); // same FakeAuthAdapter identity, same Account

      const response = await localApp.inject({ method: 'GET', url: '/billing', headers: AUTH });
      expect(response.json()).toMatchObject({ plan: 'free' });
    } finally {
      await localApp.close();
      await localDeps.close();
    }
  });

  it('T-BILL-17: a DB Subscription row reports pro regardless of Gateway internal state', async () => {
    await createTestSubscription(ownerAccountId, 'active');
    // FakeBillingGateway here is left completely untouched (no customer, no
    // canonical subscription registered) — the DB row alone must suffice.
    const response = await app.inject({ method: 'GET', url: '/billing', headers: AUTH });
    expect(response.json()).toMatchObject({ plan: 'pro' });
  });

  it('T-BILL-09: POST /billing/checkout creates a BillingCustomer, and reuses it on a second call', async () => {
    const first = await app.inject({ method: 'POST', url: '/billing/checkout', headers: AUTH });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ url: expect.any(String) });

    const customerCountAfterFirst = await deps.prisma.billingCustomer.count({ where: { accountId: ownerAccountId } });
    expect(customerCountAfterFirst).toBe(1);
    const firstCustomer = await deps.prisma.billingCustomer.findUniqueOrThrow({ where: { accountId: ownerAccountId } });

    const second = await app.inject({ method: 'POST', url: '/billing/checkout', headers: AUTH });
    expect(second.statusCode).toBe(200);

    const customerCountAfterSecond = await deps.prisma.billingCustomer.count({ where: { accountId: ownerAccountId } });
    expect(customerCountAfterSecond).toBe(1); // reused, not duplicated
    const secondCustomer = await deps.prisma.billingCustomer.findUniqueOrThrow({ where: { accountId: ownerAccountId } });
    expect(secondCustomer.stripeCustomerId).toBe(firstCustomer.stripeCustomerId);
  });

  it('checkout is rejected with 409 ALREADY_PRO for an already-Pro Account', async () => {
    await createTestSubscription(ownerAccountId, 'active');
    const response = await app.inject({ method: 'POST', url: '/billing/checkout', headers: AUTH });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'ALREADY_PRO', message: expect.any(String) } });
  });

  it('T-BILL-10: POST /billing/portal requires an existing BillingCustomer', async () => {
    const response = await app.inject({ method: 'POST', url: '/billing/portal', headers: AUTH });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: 'BILLING_CUSTOMER_NOT_FOUND', message: expect.any(String) } });
  });

  it('POST /billing/portal succeeds once a BillingCustomer exists', async () => {
    await app.inject({ method: 'POST', url: '/billing/checkout', headers: AUTH }); // creates the BillingCustomer
    const response = await app.inject({ method: 'POST', url: '/billing/portal', headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ url: expect.any(String) });
  });

  it('T-BILL-15: a Checkout call alone (no webhook ever delivered) never grants Pro', async () => {
    await app.inject({ method: 'POST', url: '/billing/checkout', headers: AUTH });
    const response = await app.inject({ method: 'GET', url: '/billing', headers: AUTH });
    expect(response.json()).toMatchObject({ plan: 'free' });
  });

  it('T-BILL-18: N parallel Checkout requests for a brand-new Account create exactly one BillingCustomer, none 500 (F-09)', async () => {
    const subject = `concurrent-billing-subject-${Date.now()}`;
    const headers = { authorization: `Bearer ${subject}` };
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => app.inject({ method: 'POST', url: '/billing/checkout', headers })),
    );
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }

    const account = await prisma.account.findUniqueOrThrow({ where: { authSubject: subject } });
    const count = await prisma.billingCustomer.count({ where: { accountId: account.id } });
    expect(count).toBe(1);
  });
});
