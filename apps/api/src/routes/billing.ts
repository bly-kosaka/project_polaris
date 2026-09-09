import { PrismaBillingCustomerRepository, PrismaSubscriptionRepository } from '@polaris/db';
import { resolveEntitlement } from '@polaris/domain';
import type { FastifyInstance } from 'fastify';
import { ensureBillingCustomer } from '../billing/ensure-billing-customer.js';
import type { ApiDeps } from '../deps.js';
import { toBillingSummaryDto } from '../dto/billing.js';
import { sendApiError } from '../errors.js';

/**
 * 57_Development_Setup_and_Eighth_Sprint.md §17/§19/§34. All three routes
 * sit in the Protected Scope (apps/api/src/server.ts) — Authentication and
 * Email Verification are already enforced by the two global hooks before
 * any handler here runs.
 */
export function registerBillingRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get('/billing', async (req, reply) => {
    const subscription = await new PrismaSubscriptionRepository(deps.prisma).findByAccountId(req.account.id);
    const entitlement = resolveEntitlement(subscription);
    const billingCustomer = await new PrismaBillingCustomerRepository(deps.prisma).findByAccountId(req.account.id);
    return reply.send(toBillingSummaryDto(entitlement, billingCustomer !== null));
  });

  app.post('/billing/checkout', async (req, reply) => {
    const subscription = await new PrismaSubscriptionRepository(deps.prisma).findByAccountId(req.account.id);
    const entitlement = resolveEntitlement(subscription);
    if (entitlement.plan === 'pro') {
      return sendApiError(reply, 409, 'ALREADY_PRO', 'This Account is already on the Pro plan.');
    }

    const { stripeCustomerId } = await ensureBillingCustomer(deps, req.account.id, req.principal.email);
    const { url } = await deps.billingGateway.createCheckoutSession({
      stripeCustomerId,
      accountId: req.account.id,
      successUrl: `${deps.appBaseUrl}/billing?checkout=success`,
      cancelUrl: `${deps.appBaseUrl}/billing`,
    });
    return reply.send({ url });
  });

  app.post('/billing/portal', async (req, reply) => {
    const billingCustomer = await new PrismaBillingCustomerRepository(deps.prisma).findByAccountId(req.account.id);
    if (billingCustomer === null) {
      return sendApiError(reply, 409, 'BILLING_CUSTOMER_NOT_FOUND', 'No Billing Customer exists for this Account yet.');
    }

    const { url } = await deps.billingGateway.createPortalSession({
      stripeCustomerId: billingCustomer.stripeCustomerId,
      returnUrl: `${deps.appBaseUrl}/billing`,
    });
    return reply.send({ url });
  });
}
