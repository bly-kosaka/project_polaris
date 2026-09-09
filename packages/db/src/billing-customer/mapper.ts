import type { BillingCustomer } from '@polaris/domain';
import type { BillingCustomer as PrismaBillingCustomer } from '../generated/prisma/client.js';

export function toDomainBillingCustomer(record: PrismaBillingCustomer): BillingCustomer {
  return {
    id: record.id,
    accountId: record.accountId,
    stripeCustomerId: record.stripeCustomerId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
