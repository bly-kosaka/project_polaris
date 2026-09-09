import { describe, expect, it } from 'vitest';
import { billingSummarySchema } from '../../api/billing-schema';

function validPayload() {
  return {
    plan: 'free',
    subscription: { status: null, cancelAtPeriodEnd: false },
    features: { aiExplanationRetry: false },
    canManageBilling: false,
  };
}

describe('billingSummarySchema', () => {
  it('parses a valid Free Billing Summary response', () => {
    const result = billingSummarySchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('parses a valid Pro Billing Summary response with currentPeriodEnd present', () => {
    const payload = {
      plan: 'pro',
      subscription: { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-02-01T00:00:00Z' },
      features: { aiExplanationRetry: true },
      canManageBilling: true,
    };
    const result = billingSummarySchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid plan value', () => {
    const payload = validPayload();
    payload.plan = 'enterprise' as never;
    const result = billingSummarySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a missing features field', () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.features;
    const result = billingSummarySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
