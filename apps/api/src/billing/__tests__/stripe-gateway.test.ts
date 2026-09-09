import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { StripeGateway } from '../stripe-gateway.js';

/**
 * 57_Development_Setup_and_Eighth_Sprint.md §51 / 59_Sprint_8_Plan_Final_Review.md:
 * signature verification is tested against the REAL `stripe` SDK — never
 * mocked, unlike every other Stripe call this Gateway makes (see
 * `apps/api/src/__tests__/fake-billing-gateway.ts`'s trivial fake for
 * everything else). Uses the SDK's own `webhooks.generateTestHeaderString`
 * helper, confirmed against the installed `stripe@22.6.1`'s own types, to
 * produce a validly-signed test payload without any network call.
 */
describe('StripeGateway.verifyWebhookSignature', () => {
  const webhookSecret = 'whsec_test_secret_for_unit_tests_only';
  const gateway = new StripeGateway({ secretKey: 'sk_test_unused', webhookSecret, proPriceId: 'price_unused' });

  function signedPayload(payload: string): { body: Buffer; header: string } {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    return { body: Buffer.from(payload, 'utf8'), header };
  }

  it('accepts a validly-signed payload and returns the generic {id, type, data} envelope', () => {
    const payload = JSON.stringify({
      id: 'evt_test_1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test_1' } },
    });
    const { body, header } = signedPayload(payload);

    const event = gateway.verifyWebhookSignature(body, header);

    expect(event.id).toBe('evt_test_1');
    expect(event.type).toBe('customer.subscription.updated');
    expect(event.data).toEqual({ object: { id: 'sub_test_1' } });
  });

  it('throws on a mismatched-secret signature', () => {
    const payload = JSON.stringify({ id: 'evt_test_2', type: 'customer.subscription.updated', data: {} });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_a_totally_different_secret' });

    expect(() => gateway.verifyWebhookSignature(Buffer.from(payload, 'utf8'), header)).toThrow();
  });

  it('throws on a tampered payload (body does not match what was signed)', () => {
    const originalPayload = JSON.stringify({ id: 'evt_test_3', type: 'customer.subscription.updated', data: {} });
    const header = Stripe.webhooks.generateTestHeaderString({ payload: originalPayload, secret: webhookSecret });
    const tamperedBody = Buffer.from(JSON.stringify({ id: 'evt_test_3-tampered', type: 'x', data: {} }), 'utf8');

    expect(() => gateway.verifyWebhookSignature(tamperedBody, header)).toThrow();
  });

  it('throws on a malformed signature header', () => {
    const payload = JSON.stringify({ id: 'evt_test_4', type: 'customer.subscription.updated', data: {} });
    expect(() => gateway.verifyWebhookSignature(Buffer.from(payload, 'utf8'), 'not-a-real-signature')).toThrow();
  });
});
