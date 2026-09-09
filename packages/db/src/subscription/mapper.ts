import type { SubscriptionSnapshot } from '@polaris/domain';
import type { Subscription as PrismaSubscription } from '../generated/prisma/client.js';

export function toDomainSubscription(record: PrismaSubscription): SubscriptionSnapshot {
  return {
    id: record.id,
    accountId: record.accountId,
    provider: record.provider,
    providerSubscriptionId: record.providerSubscriptionId,
    ...(record.providerPriceId !== null ? { providerPriceId: record.providerPriceId } : {}),
    status: record.status,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    ...(record.currentPeriodEnd !== null ? { currentPeriodEnd: record.currentPeriodEnd.toISOString() } : {}),
    ...(record.providerUpdatedAt !== null ? { providerUpdatedAt: record.providerUpdatedAt.toISOString() } : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
