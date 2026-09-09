import type { SubscriptionSnapshot } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import { toDomainSubscription } from './mapper.js';
import type { SubscriptionRepository } from './subscription-repository.js';
import type { UpsertSubscriptionInput } from './types.js';

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async findByAccountId(accountId: string): Promise<SubscriptionSnapshot | null> {
    try {
      const record = await this.client.subscription.findUnique({ where: { accountId } });
      return record !== null ? toDomainSubscription(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByProviderSubscriptionId(providerSubscriptionId: string): Promise<SubscriptionSnapshot | null> {
    try {
      const record = await this.client.subscription.findUnique({ where: { providerSubscriptionId } });
      return record !== null ? toDomainSubscription(record) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async upsertByProviderSubscriptionId(input: UpsertSubscriptionInput): Promise<SubscriptionSnapshot> {
    try {
      const shared = {
        providerPriceId: input.providerPriceId ?? null,
        status: input.status,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        currentPeriodEnd: input.currentPeriodEnd !== undefined ? new Date(input.currentPeriodEnd) : null,
        providerUpdatedAt: input.providerUpdatedAt !== undefined ? new Date(input.providerUpdatedAt) : null,
      };
      const record = await this.client.subscription.upsert({
        where: { providerSubscriptionId: input.providerSubscriptionId },
        create: {
          accountId: input.accountId,
          provider: input.provider,
          providerSubscriptionId: input.providerSubscriptionId,
          ...shared,
        },
        update: shared,
      });
      return toDomainSubscription(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
