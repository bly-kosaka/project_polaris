import type { UsageEvent } from '@polaris/domain';
import type { PrismaClientLike } from '../client.js';
import { mapPrismaError } from '../errors.js';
import { toDomainUsageEvent } from './mapper.js';
import type { CreateUsageEventInput } from './types.js';
import type { UsageEventRepository } from './usage-event-repository.js';

export class PrismaUsageEventRepository implements UsageEventRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async create(input: CreateUsageEventInput): Promise<UsageEvent> {
    try {
      const record = await this.client.usageEvent.create({
        data: { accountId: input.accountId, analysisId: input.analysisId, metric: input.metric },
      });
      return toDomainUsageEvent(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
