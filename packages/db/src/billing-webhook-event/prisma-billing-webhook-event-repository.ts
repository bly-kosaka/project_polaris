import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import type { BillingWebhookEventRepository } from './billing-webhook-event-repository.js';
import type { CreateBillingWebhookEventInput } from './types.js';

export class PrismaBillingWebhookEventRepository implements BillingWebhookEventRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateBillingWebhookEventInput): Promise<void> {
    try {
      await this.client.billingWebhookEvent.create({
        data: { provider: input.provider, providerEventId: input.providerEventId, eventType: input.eventType },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
