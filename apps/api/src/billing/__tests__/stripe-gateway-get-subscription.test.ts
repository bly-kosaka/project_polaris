import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `getSubscription()`'s field-mapping logic was never exercised by any test
 * before the Sprint 8 Manual Stripe Test Mode Smoke Test
 * (`md/61_Sprint_8_Implementation_Review.md` §22) — Worker/API integration
 * tests all inject `FakeBillingGateway`, whose `getSubscription()` is a
 * trivial stub controlled by `setCanonicalSubscription()`, so the real
 * mapping code in `stripe-gateway.ts` was never actually run by the
 * automated suite. Mocks the `stripe` package (`vi.hoisted()` +
 * `vi.mock('stripe', ...)`, `packages/auth/src/__tests__/clerk-auth-adapter.test.ts`'s
 * pattern) rather than the real SDK — kept in a separate file from
 * `stripe-gateway.test.ts`, whose signature-verification tests deliberately
 * use the real SDK and must not be affected by this mock.
 */
const { mockRetrieve } = vi.hoisted(() => ({ mockRetrieve: vi.fn() }));

vi.mock('stripe', () => {
  class MockStripe {
    subscriptions = { retrieve: mockRetrieve };
  }
  return { default: MockStripe };
});

function fakeStripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_test_1',
    customer: 'cus_test_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    items: {
      data: [
        {
          price: { id: 'price_test_1' },
          current_period_end: 1792285917,
        },
      ],
    },
    ...overrides,
  };
}

describe('StripeGateway.getSubscription', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps cancelAtPeriodEnd=true when Stripe sets the cancel_at_period_end boolean', async () => {
    const { StripeGateway } = await import('../stripe-gateway.js');
    mockRetrieve.mockResolvedValue(fakeStripeSubscription({ cancel_at_period_end: true }));
    const gateway = new StripeGateway({ secretKey: 'sk_test_unused', webhookSecret: 'whsec_unused', proPriceId: 'price_unused' });

    const snapshot = await gateway.getSubscription('sub_test_1');

    expect(snapshot.cancelAtPeriodEnd).toBe(true);
  });

  it('maps cancelAtPeriodEnd=true when Stripe schedules cancellation via cancel_at instead of the boolean (real Test Mode finding, md/61 §22)', async () => {
    const { StripeGateway } = await import('../stripe-gateway.js');
    // Observed live in a real Stripe Test Mode Customer Portal cancellation:
    // cancel_at_period_end stayed false, but cancel_at was set to the
    // current period's end timestamp.
    mockRetrieve.mockResolvedValue(
      fakeStripeSubscription({ cancel_at_period_end: false, cancel_at: 1792285917 }),
    );
    const gateway = new StripeGateway({ secretKey: 'sk_test_unused', webhookSecret: 'whsec_unused', proPriceId: 'price_unused' });

    const snapshot = await gateway.getSubscription('sub_test_1');

    expect(snapshot.cancelAtPeriodEnd).toBe(true);
  });

  it('maps cancelAtPeriodEnd=false when neither field indicates a scheduled cancellation', async () => {
    const { StripeGateway } = await import('../stripe-gateway.js');
    mockRetrieve.mockResolvedValue(fakeStripeSubscription());
    const gateway = new StripeGateway({ secretKey: 'sk_test_unused', webhookSecret: 'whsec_unused', proPriceId: 'price_unused' });

    const snapshot = await gateway.getSubscription('sub_test_1');

    expect(snapshot.cancelAtPeriodEnd).toBe(false);
  });

  it('maps providerPriceId, status, and currentPeriodEnd from the Subscription Item (moved off the top-level Subscription in this API version)', async () => {
    const { StripeGateway } = await import('../stripe-gateway.js');
    mockRetrieve.mockResolvedValue(fakeStripeSubscription({ status: 'past_due' }));
    const gateway = new StripeGateway({ secretKey: 'sk_test_unused', webhookSecret: 'whsec_unused', proPriceId: 'price_unused' });

    const snapshot = await gateway.getSubscription('sub_test_1');

    expect(snapshot).toMatchObject({
      providerSubscriptionId: 'sub_test_1',
      stripeCustomerId: 'cus_test_1',
      providerPriceId: 'price_test_1',
      status: 'past_due',
      currentPeriodEnd: new Date(1792285917 * 1000).toISOString(),
    });
  });
});
