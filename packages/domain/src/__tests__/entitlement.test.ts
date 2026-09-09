import { describe, expect, it } from 'vitest';
import { resolveEntitlement } from '../entitlement.js';
import type { SubscriptionSnapshot } from '../billing.js';

function subscription(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    id: 'sub-1',
    accountId: 'acc-1',
    provider: 'stripe',
    providerSubscriptionId: 'sub_stripe_1',
    status: 'active',
    cancelAtPeriodEnd: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveEntitlement', () => {
  it('returns free with every feature disabled when there is no Subscription at all', () => {
    const result = resolveEntitlement(null);
    expect(result.plan).toBe('free');
    expect(result.features.aiExplanationRetry).toBe(false);
    expect(result.billing).toEqual({ status: null, cancelAtPeriodEnd: false });
  });

  it.each(['active', 'trialing', 'past_due'])('grants pro for status=%s (57_Development_Setup_and_Eighth_Sprint.md §11)', (status) => {
    const result = resolveEntitlement(subscription({ status }));
    expect(result.plan).toBe('pro');
    expect(result.features.aiExplanationRetry).toBe(true);
  });

  it.each(['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused', 'a-totally-unknown-future-status'])(
    'Fail Closed to free for status=%s, including a status never seen before (§12)',
    (status) => {
      const result = resolveEntitlement(subscription({ status }));
      expect(result.plan).toBe('free');
      expect(result.features.aiExplanationRetry).toBe(false);
    },
  );

  it('never reports an unimplemented Future feature as available, regardless of plan', () => {
    const result = resolveEntitlement(subscription({ status: 'active' }));
    expect(result.features.aiChat).toBe(false);
    expect(result.features.reportExport).toBe(false);
    expect(result.features.csvExport).toBe(false);
    expect(result.features.analysisComparison).toBe(false);
  });

  it('carries the raw subscription status/cancelAtPeriodEnd/currentPeriodEnd through to billing, verbatim', () => {
    const result = resolveEntitlement(
      subscription({ status: 'past_due', cancelAtPeriodEnd: true, currentPeriodEnd: '2026-02-01T00:00:00.000Z' }),
    );
    expect(result.billing).toEqual({
      status: 'past_due',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
    });
  });

  it('omits currentPeriodEnd from billing when the Subscription has none', () => {
    const result = resolveEntitlement(subscription());
    expect(result.billing).not.toHaveProperty('currentPeriodEnd');
  });
});
